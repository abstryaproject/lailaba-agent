# Lailaba AI server (FastAPI, ~/lailaba-ai) — detail & restore map

## What it is
A self-hosted FastAPI AI assistant (chat + admin + `/lab` security module + Paystack
payments), separate from the Lailaba gateway/dashboard. OpenRouter-backed.
Repo: `~/lailaba-ai`. Web: https://github.com/abstryaproject/lailaba-ai

Endpoints (all on `:8000`):
- `/health`  -> 200 when up
- `/`        -> web UI
- `/docs`    -> Swagger API docs
- `/lab`     -> security training module
- `/admin`   -> admin dashboard

## Local files that matter
- `app/main.py`        - FastAPI app (`app.main:app`)
- `venv/bin/uvicorn`   - runner
- `.env`               - OPENROUTER_API_KEY, OPENROUTER_MODEL, SECRET_KEY, ADMIN_EMAIL set
- `start.sh`           - portable launcher (defaults HOST 0.0.0.0, PORT 8000; reads flags)
- `start-server.sh`    - tmux launcher variant
- `lailaba-ai.service` - systemd unit (for Debian; irrelevant on Termux)

## Start manually (Termux)
```bash
cd ~/lailaba-ai && source venv/bin/activate
tmux new-session -d -s lailaba-server
tmux send-keys -t lailaba-server \
  "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info" Enter
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health   # expect 200
```

## Auto-restore chain (survives reboot)
```
Termux:Boot app (must be installed + granted)
  └─ ~/.termux/boot/01-lailaba-server   (intentional NO-OP; do not `exec` here - it blocked boot)
  └─ ~/.termux/boot/02-hermes-startup
       ├─ starts Hermes gateway in tmux "hermes-gateway"
       ├─ starts gateway watcher in tmux "hermes-gateway-watch"
       └─ ~/.local/bin/start-services.sh   (waits for network)
            └─ ~/.local/bin/service-manager.sh
                 ├─ sshd (8022)
                 ├─ Lailaba AI server  -> tmux "lailaba-server", 0.0.0.0:8000  (GUARDED by tmux has-session)
                 └─ Hermes dashboard   -> tmux "hermes-dashboard", 0.0.0.0:9119
```
To start everything at once (after boot, or manually): `bash ~/.local/bin/service-manager.sh`

## Pitfall - stale PID holds :8000
`service-manager.sh` guards with `tmux has-session -t lailaba-server` ONLY.
If a prior `uvicorn app.main` PID is alive (no tmux session, e.g. a background
terminal launch), the guarded launch sees no session, spawns a new one, which
fails to bind -> "address already in use" -> exits. Result: :8000 owned by the
orphan, managed session dead.
Fix: `pgrep -af "uvicorn app.main" | grep -v "tmux\|bash -c"` -> `kill <pid>`,
`tmux kill-session -t lailaba-server`, then relaunch. Verify owning PID == tmux session.

## Pitfall - `lailaba proxy` is NOT the OpenRouter server
`lailaba proxy start --port 8000` exists (OpenAI-compatible) but its only upstreams
are Nous Portal and xAI Grok OAuth, both require login (`lailaba auth add nous`).
It does NOT route OpenRouter. For OpenRouter serving use this FastAPI app.
`lailaba proxy start` exits immediately with "Not logged into Nous Portal" if neither
upstream is authenticated.
