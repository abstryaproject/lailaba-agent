---
name: lailaba-dashboard-extensions
description: How to extend the Lailaba web dashboard (port 9119, lailaba_cli/web_server.py FastAPI) and the gateway API server with new features — adding API routes, serving standalone pages, enabling the gateway api_server, and the hard-won config/tool gotchas (dual LAILABA_HOME, read-only /tmp, TTS/STT signatures, stale-boot gateway 401s). Use when adding chat/voice/portal/session/file features to the dashboard or wiring it to the agent.
---

# Lailaba Dashboard & Gateway Extensions

The Lailaba dashboard is a **FastAPI app** at `lailaba_cli/web_server.py` (port 9119), started with:

```
lailaba dashboard --port 9119 --host 0.0.0.0 --no-open --skip-build
```

The core file is ~13.7k lines. **Do NOT edit its body for new features.** Instead add a
small module with an `APIRouter` and `register_portal(app)` (see pattern below), then call
it once right after `app = FastAPI(...)` near the top of `web_server.py`.

The gateway (`lailaba gateway run`) already exposes a built-in HTTP API server
(`api_server` platform) — the SAME channel Telegram uses to chat with the agent. Mirror
that for dashboard features instead of re-running the agent in-process.

## Pattern: add a feature module (don't touch web_server.py core)

`lailaba_cli/portal_api.py`:

```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/portal", tags=["portal"])

# ... endpoints using router.get/post ...

def register_portal(app) -> None:
    app.include_router(router)
    @app.get("/portal")                       # serve a standalone page
    async def _serve_portal():
        from fastapi.responses import HTMLResponse
        html = (Path(__file__).parent / "web_dist" / "portal.html").read_text()
        tok = getattr(app.state, "_session_token", "") or os.environ.get("LAILABA_DASHBOARD_SESSION_TOKEN","")
        html = html.replace("</head>", f'<script>window.__LAILABA_SESSION_TOKEN__="{tok}";</script></head>', 1)
        return HTMLResponse(html, headers={"Cache-Control":"no-store, no-cache, must-revalidate"})
```

Wire it in `web_server.py` (after `app = FastAPI(...)`):

```python
from lailaba_cli.portal_api import register_portal
register_portal(app)
```

A standalone page goes in `lailaba_cli/web_dist/portal.html` (NOT the React SPA build —
avoids an `npm run build`). Inject the session token the same way the SPA's `_serve_index`
does, so the page can call `/api/portal/*` with `X-Lailaba-Session-Token`.

## Making routes public (auth bypass)

The dashboard runs an auth gate. To expose endpoints without a login cookie (e.g. a
personal portal mirroring Telegram's trust model):

- Add `/api/...` paths to `lailaba_cli/dashboard_auth/public_paths.py` → `PUBLIC_API_PATHS` frozenset.
- Add page prefixes (e.g. `"/portal"`) to `_GATE_PUBLIC_PREFIXES` in `lailaba_cli/dashboard_auth/middleware.py`.

⚠️ Security: only do this on a trusted/personal bind. If the dashboard is on `0.0.0.0`,
front the portal with the same auth as the rest of the UI, or bind loopback + tunnel.

## Gateway api_server (the agent chat channel)

Enable in `~/.lailaba/config.yaml` (or whichever config the **gateway** actually loads — see
GOTCHA 1):

```yaml
gateway:
  platforms:
    api_server:
      enabled: true
      host: 127.0.0.1
      port: 8642
      extra:
        key: <random-secret>     # API_SERVER_KEY — REQUIRED even for loopback
```

Auth: `Authorization: Bearer <key>`. Key lives at `gateway.platforms.api_server.extra.key`
(verified via `hmac.compare_digest` against the `Authorization` header, NOT `X-API-Key`).

Useful endpoints:
- `GET  /api/sessions` — list sessions
- `POST /api/sessions` (body `{"session_id": "..."}`) — create session
- `POST /api/sessions/{id}/chat` (body `{"message": "..."}`) — one agent turn
- `POST /v1/chat/completions` — OpenAI-format, `X-Lailaba-Session-Id` header for continuity

The `/chat` reply is **double-encoded**: `{"reply": "{\"message\":{\"role\":\"assistant\",\"content\":\"...\”}}"}`.
Unwrap one JSON level and read `message.content`. See `references/dashboard-portal-cookbook.md`.

## TTS (reply → audio)

```python
from tools.tts_tool import text_to_speech_tool
res = text_to_speech_tool(text="...", output_path="/path/to/out.ogg")
# res = {"success": True, "file_path": "...", "provider": "hausa", ...}
# file is written ASYNCHRONOUSLY — poll for existence up to ~20s before serving.
```

Provider `hausa` works without an API key. Output is Ogg/Opus.

## STT (inbound audio → text)

```python
from tools.transcription_tools import transcribe_audio
result = transcribe_audio("/path/to/audio.wav")   # dict, NOT a string!
# result = {"success": True, "transcript": "...", "provider": "groq"}
text = result.get("transcript") or ""
```

Uses Groq Whisper (`GROQ_API_KEY` in `~/.lailaba/.env`). ~11–12s per call. Accepts wav/ogg/mp3/m4a.

## GOTCHAS (read before debugging)

**GOTCHA 1 — dual LAILABA_HOME.** The gateway and dashboard can resolve to DIFFERENT config
homes: gateway defaults to `~/.lailaba`, dashboard runs with `LAILABA_HOME=~/.hermes`. A
portal reading the dashboard's `~/.hermes/config.yaml` will find NO `api_server` key (the key
is in `~/.lailaba/config.yaml`) → silent `Bearer ` → permanent `401`. Fix: scan BOTH
`~/.lailaba/config.yaml` and `~/.hermes/config.yaml` and prefer the one that actually has the
key. Stage audio/files under `~/.lailaba/portal_files` (known-writable + consistent for both
TTS and STT).

**GOTCHA 2 — /tmp is READ-ONLY** on this Termux. Never stage files there; the TTS/STT tools
fail or hang. Use `~/.lailaba/portal_files`.

**GOTCHA 3 — stale boot-time gateway → 401.** If the gateway was started at BOOT (process
start time shows `Thu Jan 1 1970` because Android has no RTC) BEFORE you set `api_server`,
it holds old key/state and rejects every key forever. Kill that gateway PID and restart fresh
(`tmux kill-session -t hermes-gateway` + relaunch `lailaba gateway run`). A fresh process
picks up the current config.

**GOTCHA 4 — restart hygiene.** `pgrep -f "lailaba dashboard"` self-matches the shell running
the command and kills it (exit -9). Kill by EXPLICIT PID: `kill -9 <pid>` where pid =
`pgrep -f "[l]ailaba dashboard" | head -1` (bracket trick prevents self-match). Remove
`lailaba_cli/__pycache__/portal_api*.pyc` after editing so the new code loads.

**GOTCHA 5 (UNRESOLVED) — in-process STT hang.** Calling `transcribe_audio` via
`asyncio.to_thread(...)` inside the LIVE FastAPI dashboard hangs (HTTP=000 timeout), even
though the identical call works standalone AND works via plain `asyncio.to_thread` in a
script. Suspected event-loop / gateway-shared-state deadlock. Workaround: run STT in a
separate `subprocess` (small helper script) rather than in-process. Track this — if you
solve it, update here.

## Verify end-to-end

After changes: kill dashboard by explicit PID, restart, then:

```
curl -s http://127.0.0.1:9119/api/portal/status      # expect gateway up, api_server up
curl -s -X POST http://127.0.0.1:9119/api/portal/chat -H 'Content-Type: application/json' -d '{"message":"..."}'
curl -s -X POST http://127.0.0.1:9119/api/portal/tts  -H 'Content-Type: application/json' -d '{"text":"..."}' -o ~/.lailaba/portal_files/x.ogg
# NOTE: save curl -o output to a WRITABLE path (~/.lailaba/portal_files), never /tmp
```

See `references/dashboard-portal-cookbook.md` for the concrete reply-unwrap and config-scan snippets.
