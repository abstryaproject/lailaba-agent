---
name: lailaba-services
description: Start, stop, status-check, and troubleshoot Lailaba's runtime services — the messaging gateway (Telegram/Discord/Slack/…) and the local web dashboard (port 9119) — with emphasis on Termux/Android where the dashboard's web UI build commonly fails with a rolldown native-binding error.
---

# Lailaba Services (gateway + dashboard)

Use this skill whenever the user asks to start / stop / restart / status-check
Lailaba's gateway or web dashboard, or when the dashboard won't come up.

## What services exist
- **Gateway** — messaging bridge to Telegram/Discord/Slack/~20 platforms.
  Started with `lailaba gateway`; state reported under `◆ Gateway Service`
  in `lailaba status`. Telegram is usually the configured "home" platform.
- **Dashboard** — local web UI, default port **9119**. Started with
  `lailaba dashboard [--no-open]`. On first launch (no prebuilt `dist`) it
  **builds the web UI** (`tsc -b && vite build`) — slow on Termux (1–3 min).
- **Lailaba AI server (FastAPI)** — a *separate* self-hosted project (NOT part
  of the gateway/dashboard) at `~/lailaba-ai`. FastAPI + uvicorn, OpenRouter-
  backed, serves the chat web UI / admin / lab / API docs on default port
  **8000** (`0.0.0.0:8000`). Started with `uvicorn app.main:app --host 0.0.0.0
  --port 8000` from inside its venv. Health: `curl 127.0.0.1:8000/health`.
  Managed in tmux session `lailaba-server`. See `references/lailaba-ai-server.md`.
  NOTE: `lailaba proxy` (the built-in OpenAI-compatible server) routes ONLY to
  Nous Portal / xAI OAuth — NOT OpenRouter. Use this app for OpenRouter serving.

## Start the Lailaba AI server (8000) — Termux/Boot managed
This runs as a managed tmux session `lailaba-server`. On boot the chain
`Termux:Boot → ~/.termux/boot/02-hermes-startup → ~/.local/bin/start-services.sh
→ ~/.local/bin/service-manager.sh` relaunches it (guarded). To start manually:
```bash
cd ~/lailaba-ai && source venv/bin/activate
tmux new-session -d -s lailaba-server
tmux send-keys -t lailaba-server \
  "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1" Enter
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health   # 200 = up
```

## Start (background — these are long-lived servers)
```bash
# Termux / WSL / Docker (no systemd) — run in a tmux session so it survives:
tmux new-session -d -s hermes-gateway
tmux send-keys -t hermes-gateway "lailaba gateway run" Enter
# systemd/launchd hosts only:
lailaba gateway start        # installs + starts the background service
lailaba dashboard --no-open # background; builds UI, THEN serves :9119
```
NOTE: bare `lailaba gateway` (no subcommand) only prints help — it does NOT start
the gateway. On Termux use `lailaba gateway run` in tmux (the gateway `--help`
lists `run` as "recommended for WSL, Docker, Termux"). Run as a long-lived
process. Give the gateway time before judging: it prints
"⚕ Lailaba Gateway Starting…" then goes quiet. The dashboard is silent until its
npm build finishes and it binds the port.

## Verify the gateway is ACTUALLY serving (not just "running")
`lailaba gateway status` only checks that the **process PID is alive** — it does
NOT confirm the gateway is functional. A wedged agent loop still reports ✓ running.
ALWAYS read the live log before declaring the gateway healthy:
```bash
tmux capture-pane -t hermes-gateway -p 2>/dev/null | tail -n 20
tmux capture-pane -t hermes-gateway -p 2>/dev/null | grep -ciE "timeout|error|fail"   # 0 = clean
```
A fresh start should show 0 timeout/error lines. See PITFALL below + `references/gateway-health-verify.md`.

## Verify
```
lailaba status              # ◆ Gateway Service: ✓ running / ✗ stopped
lailaba dashboard --status  # lists dashboard PIDs (python + npm build child)
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9119/   # 000 = not up yet
```
Dashboard does NOT answer on :9119 until the npm build completes. A `000`
for the first ~1–2 min is normal — do not conclude it's dead.

## Gateway `api_server` platform — the chat/agent proxy (OpenAI-compat)
The gateway ships a hidden platform that exposes an OpenAI-compatible chat API:
`POST /v1/chat/completions` (with `X-Lailaba-Session-Id` header to pin/create a
session) and `POST /api/sessions/{id}/chat`. This is how a web/portal front-end can
drive the same agent the Telegram gateway does. Verified live on this deploy.

Enable it (config quirks — gotcha city):
```yaml
gateway:
  platforms:
    api_server:
      enabled: true
      port: 8642
      host: 127.0.0.1
      extra:
        key: <GENERATED_API_SERVER_KEY>   # MUST nest under extra.key
```
- The API key MUST live under `extra.key`. A top-level `key:` is IGNORED — the
  gateway will start, report "2 platform(s)", but reject every call with
  `401 invalid API key`. Generate e.g. `python -c "import secrets;print(secrets.token_urlsafe(32))"`.
- Auth header is **`Authorization: Bearer <key>`** (NOT `X-API-Key`).
- After editing config, **restart the gateway** — it reads the key at startup.
- `lailaba gateway status` will NOT tell you the key is missing; only a real call
  proves it. Self-verify: `curl -H "Authorization: Bearer <key>" http://127.0.0.1:8642/api/sessions` → JSON session list (not 401).
- Remember the **dual LAILABA_HOME** pitfall (skill `lailaba-termux-stack`): the
  gateway reads `~/.lailaba/config.yaml`; the dashboard (if you serve a portal from
  it) reads `~/.hermes/config.yaml`. Put the `api_server` block under whichever
  home the *gateway* process actually uses, and have the front-end read the key
  from the SAME file the gateway loaded (scan both homes, prefer the one with a key).

## Stop
`process kill <session_id>` often **fails** on the dashboard's wrapper shell
(`bash -lic '… lailaba dashboard --no-open'`). Kill by pattern instead, and
reap the orphaned build children the server leaves behind:
```
pkill -f "lailaba dashboard"
pkill -f "npm run build"; pkill -f "vite build"; pkill -f "tsc -b"
```
Confirm clean: `ps aux | grep -E "dashboard|npm run build|vite|tsc -b" | grep -v grep`.
If anything remains, `kill <pid>` the stragglers. Port 9119 frees once all are gone.

## PITFALL: Lailaba AI server "address already in use" on :8000 (stale PID)
The boot/restore guard only checks `tmux has-session -t lailaba-server` — it
does NOT verify a live listener on :8000. If a stale `uvicorn` PID still holds
the port (e.g. from a prior background launch that wasn't killed), the managed
session launches, fails to bind ("address already in use"), and silently exits —
leaving :8000 owned by the orphan. Before (re)launching in tmux:
```bash
pgrep -af "uvicorn app.main" | grep -v "tmux\|bash -c"   # find the real owner
kill <pid>                                                # free :8000 first
tmux kill-session -t lailaba-server 2>/dev/null
# then relaunch per "Start the Lailaba AI server" above
```
Confirm with `curl 127.0.0.1:8000/health` (200) AND that the owning PID matches
the tmux session's `pgrep`. Full restore recipe + boot-chain map:
see `references/lailaba-ai-server.md`.

## PITFALL: dashboard build fails — "Cannot find native binding" (rolldown)
On Termux this is the #1 reason a dashboard never serves. Symptom in the log:
```
Error: Cannot find native binding. npm has a bug related to optional
dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i`
again after removing both package-lock.json and node_modules directory.
  at requireNative (.../rolldown/dist/shared/binding-*.mjs)
```
This is the known npm optional-deps bug (#4828): the rolldown native binary for
the device arch isn't fetched, so `vite build` aborts and the server process
exits (never binds :9119). Full transcript + reproduction + fix recipe:
see `references/build-failure.md`. Gateway-side reconnect-loop failure:
see `references/gateway-reconnect-loop.md`.

**Lailaba AI server (separate FastAPI app on :8000)** — start/stop/restore chain,
boot wiring, and the stale-PID bind pitfall: see `references/lailaba-ai-server.md`.

**Gateway "running" ≠ "serving"** — `lailaba gateway status` only checks the PID;
a wedged free-tier agent loop still reports ✓ running. Verify via the tmux log
and the APITimeoutError→compaction-loop fix: see `references/gateway-health-verify.md`.
(For the separate `~/lailaba-ai` FastAPI server, a chat `[AI Service Error: 401 User not
found]` is OpenRouter's key-rejection, NOT a local user error — diagnosis recipe:
`self-hosted/lailaba-termux-stack` → `references/openrouter-401-user-not-found.md`.)

**Fix (regenerable artifacts only — source is safe):**
```
cd ~/.hermes/hermes-agent/web
rm -f package-lock.json
rm -rf node_modules          # ~4–5 MB on Termux; fully regenerable
npm install                  # if rolldown still skipped: npm install --include=optional
npm run build                # confirm tsc + vite succeed
lailaba dashboard --no-open  # now binds :9119
```
Removing `node_modules` does NOT touch source (`src/`, `public/`, `package.json`,
configs). The dashboard simply won't start again until `npm install` re-runs —
that's the intended clean baseline.

## PITFALL: gateway wedged in a Telegram reconnect loop (httpx.ConnectError)
The gateway reports `✓ running` but spams `httpx.ConnectError: All connection
attempts failed` / "No address associated with hostname" while a **fresh** shell
`curl https://api.telegram.org/` or Python `socket.create_connection(('api.telegram.org',443))`
succeeds. That mismatch means the gateway's long-lived httpx socket pool has
wedged (mobile-carrier flapping on Telegram's IP), NOT a real outage. Fix: restart
the gateway (kill pattern above, then relaunch) to open fresh connections. Verified
in-session: a restart cleared a 500s+ ConnectError spam loop into a clean run. Full
diagnosis + reproduction + fix: see `references/gateway-reconnect-loop.md`.
Only act when the error repeats in a tight continuous loop AND a fresh connect from
another process works — a single `get_updates` poll error is normal and transient.

## Notes
- Gateway Telegram `get_updates` polling errors are often transient; the
  gateway may still report ✓ running. Don't kill it for a single poll error.
- There are no scheduled cron jobs by default; "start everything" means the
  gateway + dashboard only.
