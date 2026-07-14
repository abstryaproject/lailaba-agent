---
name: lailaba-termux-services
description: Operate Lailaba's FULL persistent service stack on Termux/Android — the bundled gateway + dashboard PLUS custom app servers (e.g. a FastAPI service on :8000), the gateway self-heal watchdog, IP-watchdog cronjobs, and the Termux:Boot auto-restore chain. Use when the user asks to list/start/stop/restore services, set up reboot auto-start, or debug duplicate/stuck gateways or port conflicts on Termux. Complements the bundled `lailaba-services` skill (which only covers gateway + dashboard).
---

# Lailaba full local service stack on Termux

The bundled `lailaba-services` skill covers only the **gateway** and the **web dashboard**. On a real Termux deploy there is usually a wider stack that must come back after a reboot. This skill covers the whole thing — and the pitfalls that bite on every restart.

## The stack model
| Layer | What | Default port | How it runs |
|---|---|---|---|
| Gateway | messaging bridge (Telegram/…) | outbound | tmux `hermes-gateway` (or `lailaba gateway run`) |
| Dashboard | web UI | 9119 | `lailaba dashboard` (builds, then serves) |
| Custom app server | e.g. `~/lailaba-ai` FastAPI | 8000 | tmux `lailaba-server` (`uvicorn app.main:app`) |
| Gateway watchdog | self-heal loop | — | tmux `hermes-gateway-watch` |
| IP watchdog | cronjob, 2-min | — | `ipwatchdog.sh` |
| sshd | remote shell | 8022 | direct |
| Public tunnel | Pinggy SSH reverse tunnel -> localhost:8000 | — | tmux `pinggy` (loop) |

## Public reverse tunnel (overcome CGNAT)
The device sits behind carrier-grade NAT (the "public" IP like `105.113.17.112` is the ISP gateway, NOT a local interface — `ip -4 addr` will NOT show it; the phone's real interface IP is private, e.g. `10.x.x.x`). So `http://<public-ip>:8000` from another browser yields `ERR_CONNECTION_ABORTED`. The fix is a **reverse tunnel** (this session used Pinggy). Pattern that is PERMANENT (self-heals the 60-min free cap):
1. Write `~/.local/bin/pinggy-keepalive.sh` — a `while true` loop running `ssh -p 443 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R0:localhost:8000 free@a.pinggy.io`, parsing the URL out of the SSH banner into `~/.local/tmp/pinggy-current-url.txt`, then `wait` + restart on exit.
2. Launch it in a managed tmux session:
   ```bash
   tmux new-session -d -s pinggy "bash $HOME/.local/bin/pinggy-keepalive.sh"
   ```
3. Wire it into `service-manager.sh` so it auto-starts on boot (guard with `tmux has-session -t pinggy`).
4. Current URL always lives in `~/.local/tmp/pinggy-current-url.txt` — re-read it rather than trusting a memorized URL (it rotates every 60 min on free tier).
Verify: `URL=$(cat ~/.local/tmp/pinggy-current-url.txt); curl -s -o /dev/null -w "%{http_code}\n" "$URL/"` → `200`.
**Subdomain/Pro notes:** free tier = random rotating subdomain, no choice of name, 60-min cap. Persistent chosen subdomain OR a custom domain (e.g. `lailaba.link`) needs **Pinggy Pro** ($3/mo, token as SSH username) + for a custom domain you must also register it. You CANNOT pick a name on free. Details in `references/reverse-tunnel-pinggy.md`.

## Boot auto-restore chain (Termux:Boot)
Termux:Boot runs every executable in `~/.termux/boot/` alphabetically:
```
~/.termux/boot/02-hermes-startup
   ├─ termux-wake-lock; sleep 10 for network
   ├─ starts gateway      in tmux hermes-gateway
   ├─ starts hermes-gateway-watch in tmux hermes-gateway-watch
   └─ start-services.sh
          └─ service-manager.sh  (sshd + tmux lailaba-server:8000 + tmux hermes-dashboard:9119)
```
To make a service survive reboot, wire it into `service-manager.sh` (or its own boot script) guarded by `tmux has-session -t <name>`.

## Start / verify a service (pattern)
```bash
tmux has-session -t lailaba-server 2>/dev/null && tmux kill-session -t lailaba-server 2>/dev/null
tmux new-session -d -s lailaba-server -x 200 -y 50
tmux send-keys -t lailaba-server "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000" Enter
sleep 3; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health
```
Always use `tmux has-session` guards so re-runs never double-start.

## IP-watchdog cronjob pattern
A `no_agent` script cronjob every 2m that rewrites the app's `BASE_URL` + a `network_info.json` to the current mobile-data IP (ccmniX). In Lailaba's cron tool the script MUST live in `~/.lailaba/scripts/` (absolute / `~/…` paths are rejected):
```bash
cp ipwatchdog.sh ~/.lailaba/scripts/ipwatchdog.sh
# via cronjob tool: schedule='every 2m', script='ipwatchdog.sh', no_agent=true, deliver='local'
```

## PITFALLS
1. **Gateway watchdog rebrand bug → duplicate gateways.** `hermes-gateway-watch.sh` detects the gateway with `pgrep -f "hermes.*gateway run"`. After the hermes→lailaba binary rebrand the real proc is `lailaba gateway`, so the pattern NEVER matches → the watchdog relaunches a *new* gateway every 60s → duplicate gateways. Fix: change the pattern to `pgrep -f "lailaba gateway"`. Confirmed fix: a single gateway pair, no duplicates. (See `references/termux-boot-chain.md`.)
   **The SAME stale `hermes` matcher ALSO lived in `service-manager.sh`** — its "Hermes Gateway (main agent)" liveness check used `pgrep -f "hermes"`, which after rebrand never matches and just emits a false `WARNING: ... not running` (harmless but misleading). Fix applied: `pgrep -f "lailaba gateway"`.
   **ACTION when chasing ANY rebrand fallout:** grep the ENTIRE boot chain for the literal string `hermes` and replace with `lailaba` wherever it means the binary/process — not just the watchdog. Cover `~/.termux/boot/*`, `~/.local/bin/*`, and any `start*.sh`/`*service*.sh`. A single missed matcher costs you a duplicate gateway or a phantom WARNING.
2. **Stale PID holds the port ("address already in use").** The boot guard only checks `tmux has-session`, NOT whether a live listener is on the port. If a stale uvicorn PID is still bound to :8000, the managed instance fails to bind and exits. Always `kill` any stale process on the port before relaunching into the managed tmux session.
3. **Direct background launch ≠ managed session.** Starting a service via a raw `terminal(background)` makes it NOT live in the named tmux session the boot script expects. On reboot the boot script won't see the tmux session and spawns a second instance → port conflict. Migrate the process into the managed tmux session before declaring done.
4. **`cronjob` script paths are relative to `~/.lailaba/scripts/`.** Passing an absolute or `~/…` path is rejected with "Script path must be relative to ~/.lailaba/scripts/". Copy the script there and pass only the filename.
5. **`pkill -f` self-match kills your own shell.** `pkill -f "app.main:app"` matches the bash running the command (cmdline contains that string), so it kills the shell and the target survives → returns `exit_code: -9`. Use the bracket trick `pkill -9 -f "[u]vicorn app.main:app"` / `pkill -9 -f "[l]ab/runtime/labserve.py"`, or kill by exact PID from `ps -eo pid,args`. (Full recipes: `references/termux-process-kill.md`.)
6. **Phantom background-process watch notifications.** After killing an old service + spawning a new one, the runner may re-fire `watch_patterns` on BUFFERED output from the already-dead old PID. Treat delayed "listening on"/"Application startup complete" banners from a killed PID as suspect — verify with `ps` + a live `curl` probe, and grep served HTML/JS for the expected build label (e.g. `app.js?v=14`).
7. **`ss`/`netstat` unreliable on this Termux build.** They reported ports "free" while actually LISTENING. Trust `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:PORT/` and `ps -eo pid,args | grep "[p]attern"` instead.
   **CAVEAT — `curl` returns `000` for non-HTTP listeners, which is NOT "down".** sshd on `:8022` is not an HTTP server, so `curl ... 127.0.0.1:8022/` yields `000` even when sshd is healthy. Probe sshd with `nc -z -w3 127.0.0.1 8022` (or bash `/dev/tcp`) and confirm the process with `pgrep -x sshd`. Use `curl` ONLY for the HTTP services: `:8000` → `200`, `:9119` → `302` (redirect to login — healthy, not an error). Full probe recipe: `references/boot-verify-probes.md`.

## References
- `references/termux-boot-chain.md` — the actual boot/watchdog/watchdog scripts (condensed, with the rebrand fix).
- `references/termux-process-kill.md` — safe `pkill` (bracket trick, avoid self-match), `ss`/`netstat` unreliability, phantom watch-banner handling, kill→launch→verify sequence. **Includes the GOTCHA: bracket trick still self-matches if the target binary appears literally elsewhere in the same command (e.g. inside a tmux launch string).**
- `references/restore-from-github.md` — safe restore of `~/lailaba-ai` to `origin/main` without losing uncommitted work (`git stash -u` first), plus the inverse "fully remove a mounted service" checklist.
- `references/boot-verify-probes.md` — exact post-boot verification probes (curl for 8000/9119, `nc` for sshd 8022, `ps`/`tmux ls` for gateway + long-lived procs). Avoids the `000`=down misread on sshd.
- `references/reverse-tunnel-pinggy.md` — full Pinggy keepalive script + the CGNAT diagnosis (`ERR_CONNECTION_ABORTED` on the ISP gateway IP) + Pro/subdomain rules.
