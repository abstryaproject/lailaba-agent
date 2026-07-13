# Rate-limiter 429 faking an "offline" Live Range pill

## Symptom the user reported
Live Range card on `/lab` showed:
```
Live Range · Hands-on · runs on this device · offline
```
...while the server was actually up and `curl` from the CLI returned `200`.

## Root cause (proven from live uvicorn logs)
`app/main.py` `rate_limiter` caps **20 req/min per client IP**. The browser IS a
loopback client (`127.0.0.1`), so it shares that budget. On every `/lab` page load
the browser fires a *burst* at once:

```
GET /api/lab/progress        429 Too Many Requests
GET /api/lab/challenges      429
GET /api/lab/runtime/        429
GET /api/lab/runtime/api/health  429   <- the Live Range probe
GET /sw.js                   429
```

The Live Range status pill does `fetch('/api/lab/runtime/api/health')`; when that
returns 429, `res.ok` is false → pill renders "offline". `curl` from the CLI slips
through because it's a single quiet request at a quiet moment. **Server up ≠ pill up.**

## WRONG old advice (do not use)
- "Space out curl probes (≤1 per check)" → does NOT help; you can't tell the browser
  to space out its asset loads.
- "Whitelist loopback `if client_ip in (127.0.0.1,…)`" → would technically work (browser
  is loopback) but is coarse; the cleaner, intended fix is path-based exemption of
  the app's own local surface.

## CORRECT fix (shipped)
In `app/main.py` `rate_limiter`, exempt the local training/PWA surface by path prefix.
Real attack surface (auth/chat/admin/payment) stays throttled.

```python
@app.middleware("http")
async def rate_limiter(request: Request, call_next):
    _p = request.url.path
    if (_p.startswith("/static") or _p.startswith("/lab") or _p.startswith("/api/lab")
            or _p in ("/sw.js", "/manifest.json", "/health")):
        return await call_next(request)
    # ... existing per-IP counting for everything else ...
```

## Verification (burst test — mirrors the browser)
The tool shell rejects `&` backgrounding, so fire a Python thread burst (loopback, like
the browser). Expect `429 count = 0` after the fix (was 20 before).

```python
import threading, urllib.request, urllib.error
base = "http://127.0.0.1:8000"
paths = (["/api/lab/runtime/api/health"] * 8 + ["/api/lab/challenges"] * 6
         + ["/api/lab/progress"] * 6 + ["/api/lab/runtime/"] * 6
         + ["/sw.js"] * 4 + ["/lab/"] * 4 + ["/health"] * 4 + ["/manifest.json"] * 2)
codes = []
lock = threading.Lock()
def hit(p):
    try:
        c = urllib.request.urlopen(base + p, timeout=8).getcode()
    except urllib.error.HTTPError as e:
        c = e.code
    with lock:
        codes.append(c)
ts = [threading.Thread(target=hit, args=(p,)) for p in paths]
[t.start() for t in ts]; [t.join() for t in ts]
print("429 count =", codes.count(429), "(must be 0)")
```
