# Live Range rebuild recipe (known-good, 2026-07-12)

Rebuild the on-device synthetic vulnerable server after a teardown. Stdlib-only (no pip), ARM-safe,
~15 MB RSS, safe on a personal device (flags hardcoded; injection SIMULATED — no real subprocess/host
access). Sits inside the Arena as a "Live Range" card; proxied same-origin so the iframe works.

## 1. Sandbox: lab/runtime/labserve.py
- `ThreadingHTTPServer(("127.0.0.1", 8080), Handler)`.
- Handlers (GET):
  - `/api/health` -> `{"status":"ok","scenarios":[...]}`
  - `/api/token` -> issues an HS256 JWT for `sub=guest` (the thing you forge from)
  - `/api/orders?user=` -> IDOR: `user=0` returns the admin order + `FLAG{...}`
  - `/api/ping?host=` -> simulated CMDi: `;` / `$()` in host triggers a fake "cat /flag" leak
- Handler (POST): `/api/admin` (Authorization: Bearer <tok>). `decode_token` is deliberately
  vulnerable: if `header["alg"] == "none"` it returns the payload WITHOUT verifying the signature ->
  JWT alg=none forgery works. Otherwise verify HMAC-SHA256 with a local secret.
- Forge recipe (client side): `base64url('{"alg":"none","typ":"JWT"}')` + "." +
  `base64url('{"sub":"admin",...}')` + "." (empty signature).
- Root `/` serves a small self-contained HTML page with live request testers.
- Verify on device BEFORE declaring done:
  `curl -s "http://127.0.0.1:8080/api/orders?user=0"`            # -> flag
  `curl -s -X POST http://127.0.0.1:8080/api/admin -H "Authorization: Bearer <forged>"`  # -> flag

## 2. Proxy: app/api/routes/lab.py (NOT main.py)
- `import httpx` and `from fastapi.responses import Response`.
- Route (on the existing `router = APIRouter(prefix="/api/lab")`):
  ```python
  @router.api_route("/runtime/{path:path}", methods=["GET", "POST", "OPTIONS"], include_in_schema=False)
  async def lab_runtime_proxy(path: str, request: Request):
      target_path = "/" + (path or "")
      norm = target_path.split("?")[0]
      if norm not in ALLOWED or not norm.startswith("/api/"):
          raise HTTPException(status_code=404, detail="not proxied")
      if ".." in path or norm.startswith("//"):
          raise HTTPException(status_code=400, detail="bad path")
      url = "http://127.0.0.1:8080" + target_path
      async with httpx.AsyncClient(timeout=8.0) as client:
          resp = await client.request(
              request.method, url, params=request.query_params,
              content=await request.body(),
              headers={k: v for k, v in request.headers.items()
                       if k.lower() not in ("host", "content-length", "connection")})
      return Response(content=resp.content, status_code=resp.status_code,
                      media_type=resp.headers.get("content-type", "application/json"))
  ```
- `ALLOWED = ("/api/health", "/api/token", "/api/orders", "/api/admin", "/api/ping", "/", "/index.html")`.
- `httpx.ConnectError` -> 503 `{"error":"live range offline"}`; `TimeoutException` -> 504.
- Full path the browser uses: `/api/lab/runtime/...` (e.g. `/api/lab/runtime/api/health`).

## 3. Arena UI: lab/index.html
Add a card after the arena-card section:
```html
<section class="lab-card lab-range" id="live-range-card">
  <div class="lab-card-head">
    <div class="lab-guardian"><div class="lab-guardian-avatar">⚡</div>
      <div><div class="lab-guardian-name">Live Range</div>
      <div class="lab-guardian-sub">Hands-on · runs on this device</div></div></div>
    <div class="lab-progress-pill" id="range-status">loading…</div>
  </div>
  <p class="lab-objective">A real (synthetic) vulnerable server is running locally...</p>
  <iframe id="live-range-frame" class="lab-range-frame" src="/api/lab/runtime/"
          title="Lailaba Live Range" loading="lazy"></iframe>
</section>
```

## 4. Status pill: lab/js/app.js
```js
fetch('/api/lab/runtime/api/health').then(r => r.ok ? r.json() : Promise.reject(r.status))
  .then(j => { el.textContent = 'online · ' + (j.scenarios||3).length + ' scenarios'; el.className='lab-progress-pill online'; })
  .catch(() => { el.textContent = 'offline'; el.className='lab-progress-pill offline'; });
```

## 5. CSS: lab/css/lab.css
```css
.lab-range { display: block; }
.lab-range-frame { width: 100%; min-height: 520px; border: 1px solid var(--border);
                   border-radius: 12px; background: var(--bg-3); }
#range-status.online { color: var(--accent); } #range-status.offline { color: var(--danger); }
```

## 6. Auto-start: ~/.local/bin/service-manager.sh
```sh
RANGE_TMUX=lailaba-lab
RANGE_SCRIPT="$LAILABA_DIR/lab/runtime/labserve.py"
if [ -f "$RANGE_SCRIPT" ] && ! tmux has-session -t "$RANGE_TMUX"; then
  tmux new-session -d -s "$RANGE_TMUX" -x 120 -y 30
  tmux send-keys -t "$RANGE_TMUX" "python3 $RANGE_SCRIPT" Enter
fi
```

## 7. Restart + verify (do NOT send C-c to restart a tmux server — it kills the session)
```sh
tmux kill-session -t lailaba-server; tmux new-session -d -s lailaba-server -x 200 -y 50
tmux send-keys -t lailaba-server "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1" Enter
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/lab/runtime/api/health   # 200
curl -s "http://127.0.0.1:8000/api/lab/runtime/api/orders?user=0" | grep FLAG                  # flag
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8000/api/lab/runtime/../etc/passwd" # 404 (no tunnel)
curl -s http://127.0.0.1:8000/lab/ | grep -oE 'id="(live-range-card|live-range-frame)"'       # present
```
