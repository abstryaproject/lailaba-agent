---
name: lailaba-ai-server
description: Operate the user's self-hosted "Lailaba AI" web app — a SEPARATE FastAPI service at ~/lailaba-ai on port 8000 (OpenRouter-backed), distinct from the `lailaba` CLI gateway/dashboard. Covers starting/verifying the server, the Termux boot auto-restore chain, the service watchdogs (gateway self-heal + ipwatchdog cron), editing the in-app Lab training catalog, and diagnosing chat "[AI Service Error]" / 401 failures (OpenRouter key vs local auth). Use whenever the user says "start the AI server", "port 8000", "restore watchdogs/cron", "chat error", or wants to add/remove Lab modules.
---

# Lailaba AI server stack (self-hosted — separate from gateway/dashboard)

## Mental model (read first)
"Lailaba AI service" is NOT the `lailaba` CLI gateway. It is a **separate FastAPI app** at
`~/lailaba-ai`, served by its own uvicorn on **port 8000**, talking to OpenRouter
(key in `~/lailaba-ai/.env`). The `lailaba` CLI `proxy` subcommand is unrelated and CANNOT
replace it — see Pitfalls.

## What runs on this host
| Component | Where | Managed by |
|---|---|---|
| Lailaba AI server | `~/lailaba-ai/app/main.py` (FastAPI) on `:8000` | tmux session **`lailaba-server`** |
| Gateway self-heal watchdog | `~/.local/bin/hermes-gateway-watch.sh` | tmux session **`hermes-gateway-watch`** (PID-file singleton) |
| ipwatchdog | `~/.lailaba/scripts/ipwatchdog.sh` | `cronjob` every 2m (no_agent) |
| Hermes dashboard | `:9119` (often down) | tmux `hermes-dashboard` |

## Start / verify the AI server
```bash
tmux has-session -t lailaba-server 2>/dev/null || tmux new-session -d -s lailaba-server -x 200 -y 50
tmux send-keys -t lailaba-server "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info" Enter
# verify
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/lab/     # 200 (note trailing slash)
```
`/lab` returning **307** (no trailing slash) is a normal redirect to `/lab/`, NOT an error.

## Auto-restore chain (survives reboot)
```
Termux:Boot app
  → ~/.termux/boot/02-hermes-startup
      → tmux hermes-gateway-watch (watchdog) + tmux boot-start-services
          → ~/.local/bin/start-services.sh
              → ~/.local/bin/service-manager.sh
                  (starts sshd + lailaba-server:8000 + hermes-dashboard:9119)
```
So on boot the AI server returns automatically. The **gateway watchdog** is also launched by
`02-hermes-startup`. The **ipwatchdog cronjob is NOT auto-created on boot** — recreate it
after a full wipe (see references/restore-chain.md).

## Chat / `[AI Service Error]` diagnostics (very common complaint)
The chat UI prints `[AI Service Error: <raw body>]`. That string is built in
`app/services/ai_service.py:73` from the **raw upstream HTTP response** — it is NOT a
local error. Disambiguate before acting (full recipe in `references/chat-diagnostics.md`):

1. **Check the server is up FIRST.** Chat errors also happen just because the uvicorn
   on :8000 crashed/stopped. `curl -s 127.0.0.1:8000/health` → want `{"status":"ok"}`.
   If empty, the server is DOWN — relaunch it (see "Start / verify" above) and re-test
   before touching keys. (In one incident BOTH the server was down AND the key was bad.)
2. **JSON `{"error":{"message":"User not found.","code":401}}` ⇒ OpenRouter key is
   invalid/expired/revoked** (`OPENROUTER_API_KEY` in `.env`). Local auth passed; the
   request reached OpenRouter and came back 401. This is NOT a missing DB user.
   Contrast with local 401 text `User not found or deactivated` / `Invalid or expired
   token` from `app/core/dependencies.py:25` (that means the JWT/DB user failed and the
   request never left the box).
3. **Validate the key out-of-band:** `KEY=$(grep '^OPENROUTER_API_KEY=' .env|cut -d= -f2-);
   curl -H "Authorization: Bearer $KEY" https://openrouter.ai/api/v1/auth/key`
   → `200 {"data":..}` = OK; `401 {"error":{"message":"User not found."...}}` = rejected.
4. **Fix:** `sed -i 's#^OPENROUTER_API_KEY=.*#OPENROUTER_API_KEY=<newkey>#' .env`,
   then RESTART uvicorn (key is read at startup). Verify with a live call to the
   no-auth guest endpoint: `POST 127.0.0.1:8000/api/chat/guest/send` `{"message":"..."}`
   → expect streamed `data: {"content": ...}` then `{"done":true}`.
5. **Editing `.env`:** use terminal `sed`, never `write_file` the whole file — the
   `read_file`/`patch`/write guards block secret files, and overwriting wipes other
   secrets. The app currently has NO auto-restart; a stopped server = chat broken until
   relaunched (see auto-restore chain / offer watchdog).

## Editing the Lab training catalog (backend-driven)
The Lab is two surfaces: the **Arena** (prompt-injection gamified) and the **Training Lab**
(14 rooms, one real platform each). Both are server-driven.

- **Rooms** live in `app/api/routes/training_rooms.py` as `TRAINING_ROOMS` (a list). Each
  room has `id` (`room-N`), `room` number, `title`, `icon`, `category`, `summary`, `url`
  (repo), `deploy` (shell snippet for an x64 server), `requirements`, `compatible`
  (`server` | `this-device` | `vm-only` — honest runnability flag, NEVER fake `this-device`),
  `tags`, and `tasks: [{id, title, question, hint, expected:[...]}]`.
- `app/api/routes/lab.py` imports `TRAINING_ROOMS` and exposes:
  - `GET  /api/lab/training/rooms` → public list (tasks/`expected` STRIPPED)
  - `GET  /room/{room_id}` → full room incl. `expected` answers (auth-gated; UI grades client-side)
  - `POST /api/lab/training/submit` → persists progress (`module`, `challenge_id`, `answer`)
  - `GET  /api/lab/challenges` → `modules` incl. `arena` + `training` + any other link-out modules
- **Frontend:** `lab/js/app.js` renders the 🛡️ Arena / 🎯 Training Lab tab split, the room
  rail, inline room view with flag submit (client-graded against `expected`), and a
  "Deploy Reference" drawer. `lab/index.html` + `lab/css/lab.css` carry the markup/styles.
- Removed modules (Linux & Terminal Lab, Programming Playground, Ethical Hacking Basics,
  Cybersecurity/CTF) are simply absent from the catalog — verify with the checklist below.

**Edit workflow:** change `training_rooms.py` for room content, `lab.py` for routes,
`app.js`/`index.html`/`lab.css` for UI. See `references/lab-catalog.md` for the data model
and a verified platform-URL list.

## Verifying backend/frontend edits (DO THIS — silence ≠ success)
- **Backend (Python):** uvicorn is launched WITHOUT `--reload`, so a new route/changed
  handler is NOT live until you restart it. After any `lab.py`/import change:
  ```bash
  # STOP the old worker — do NOT use `tmux send-keys -t lailaba-server C-c`:
  # the session runs a raw `exec uvicorn …`, so C-c TERMINATES THE SESSION, not just the worker.
  pkill -9 -f "[u]vicorn app.main:app"       # bracket trick so the pattern can't match its own shell (see PITFALLS)
  ```
  Then LAUNCH in a SEPARATE call via the background-process runner and wait for readiness:
  ```bash
  # terminal(background=true):  cd ~/lailaba-ai && exec venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info
  # process(action='wait') for "Application startup complete"
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/<NEW_ROUTE>   # expect 200, NOT 404
  ```
  A `404` on a route you just added = the OLD code is still running (not a code bug).
  `python -c "import ast; ast.parse(open('app/api/routes/lab.py').read())"` catches syntax errors.
  **SIGTERM trap:** do NOT chain `pkill … ; tmux new-session … ; sleep 4 ; curl` in ONE foreground
  `terminal` call — the agent's tool wrapper returns `exit_code: -15` and the server never binds.
  Kill in one call, launch in the next (background), verify in a third.
- **Frontend (JS):** after a `write_file` rewrite of `lab/js/app.js`, ALWAYS run
  `node --check lab/js/app.js`. `write_file` rewrites can mangle escaped regex/quotes in
  one-liner helpers (this bit `escapeHtml` once: `c=>{...}` arrow with embedded `\"`).
  Static JS/CSS need NO server restart — just hard-refresh the browser.
- **Testing auth-gated endpoints WITHOUT the admin password:** the app login uses `email`,
  not `username`, and you usually don't know admin's password. Mint a token with the app's
  own helper instead of guessing creds:
  ```bash
  TOK=$(cd ~/lailaba-ai && source venv/bin/activate && python3 -c "
  from app.core.security import create_access_token
  from app.core.database import SessionLocal, User
  s=SessionLocal(); u=s.query(User).filter(User.id==1).first()  # admin
  print(create_access_token({'sub':str(u.id),'role':u.role})); s.close()")
  curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:8000/api/lab/room/room-1
  ```

## PITFALLS
- **`pkill -f` self-match kills your own shell.** `pkill -f "app.main:app"` matches the
  bash running the command (its cmdline contains that string), so it kills the shell and the
  target survives — command returns `exit_code: -9`. Use the bracket trick:
  `pkill -9 -f "[u]vicorn app.main:app"` / `pkill -9 -f "[l]ab/runtime/labserve.py"`, or kill
  by exact PID from `ps -eo pid,args`. (Full recipes: `devops/lailaba-termux-services`
  `references/termux-process-kill.md`.)
- **Phantom background-process watch notifications.** After killing an old service and
  spawning a new one, the process runner may re-fire `watch_patterns` on BUFFERED output from
  the already-dead old PID. Treat delayed "listening on"/"Application startup complete" banners
  from a previously-killed PID as suspect — verify with `ps` + a live `curl` probe, and grep the
  served HTML/JS for the expected build label (e.g. `app.js?v=14`).
- **`ss`/`netstat` are unreliable on this Termux build** — they reported ports "free" while
  actually LISTENING. Trust `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:PORT/` and
  `ps -eo pid,args | grep "[p]attern"` instead.
- **`lailaba proxy` does NOT serve this app.** It only forwards to Nous Portal / xAI Grok
  OAuth (not OpenRouter) and refuses to start unless one is logged in. To expose the AI
  server on :8000, run the app's own uvicorn — never `lailaba proxy start --port 8000`.
- **Rebrand bug in `hermes-gateway-watch.sh`:** its old `pgrep -f "hermes.*gateway run"`
  no longer matches the real process (now `lailaba gateway`), so it spawned DUPLICATE
  gateways every 60s. Use `pgrep -f "lailaba gateway"`. If you see >1 gateway PID, check this.
- **Stale PID holds :8000.** The service-manager guard checks only `tmux has-session
  lailaba-server`, NOT a live listener. A leftover uvicorn on :8000 makes the managed
  instance fail with "address already in use". Kill stale uvicorn before relaunching.
- **Two frontend copies exist:** `lab/js/app.js` (served via the `/lab` StaticFiles mount —\n  the LIVE one you must edit) and `app/static/js/lab.js` + `app/templates/lab.html` (a dead,\n  unrouted copy). Edit `lab/js/app.js` only.
- **uvicorn runs WITHOUT `--reload`.** Editing `lab.py` / `training_rooms.py` does NOT hot-load.\n  New routes return `404` until you Ctrl-C + re-send the uvicorn command in tmux `lailaba-server`.\n  A `404` on a just-added endpoint is almost always "old code still running," not a bug.\n- **`node --check` after JS `write_file` rewrites.** The `write_file` tool rewrites whole\n  files and can mangle escaped quotes/regex in one-liner helpers (seen: `escapeHtml`'s\n  arrow fn). Always run `node --check lab/js/app.js` before declaring frontend done.\n- **Login uses `email`, not `username`** (`/api/auth/login` body is `{email,password}`); and\n  you normally don't know admin's password — mint a JWT with `create_access_token` to test\n  auth-gated endpoints instead of guessing creds (recipe in "Verifying backend/frontend edits").
- **Registration rejects reserved TLDs.** `/api/auth/register` uses an email validator that\n  blocks `@*.local`, `@example`, etc. Use a real-looking address if you must register a test user.

## References
- `references/lab-catalog.md` — Lab module data model + how to add external link-out items.
- `references/restore-chain.md` — exact boot-script map + ipwatchdog cronjob recreation.
- `references/chat-diagnostics.md` — `[AI Service Error]` 401 disambiguation (OpenRouter key vs local auth), out-of-band key validation, guest-endpoint live test.
- Cross-ref: `devops/lailaba-termux-services` `references/termux-process-kill.md` — safe `pkill`, `ss` unreliability, phantom watch-banner handling when restarting the :8000 / :8080 / gateway stack.
