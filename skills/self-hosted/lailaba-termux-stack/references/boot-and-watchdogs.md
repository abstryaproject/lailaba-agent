# Boot chain, watchdogs & the rebrand bug

## The watchdog rebrand bug (reproduced + fixed)

`~/.local/bin/hermes-gateway-watch.sh` guarded the gateway with:

```bash
if ! pgrep -f "hermes.*gateway run" >/dev/null 2>&1; then
  nohup "$HERMES_BIN" gateway run >> "$WLOG" 2>&1 &
```

After the package was renamed hermes → lailaba, the real process is:

```
$PID /data/.../lailaba gateway          # argv: lailaba gateway
$PID /bin/bash -lic set +m; lailaba gateway 2>&1   # wrapper
```

The pattern `"hermes.*gateway run"` **never matches**, so the watchdog concluded the gateway was
always down and spawned a NEW `lailaba gateway` every 60s → duplicate gateway processes, port/Telegram
session contention.

Fix applied:

```bash
if ! pgrep -f "lailaba gateway" >/dev/null 2>&1; then
```

`$HERMES_BIN` already points to `~/bin/lailaba`, so the restart command was correct; only the
detection pattern was wrong.

### General lesson
After ANY binary/package rename, grep every watchdog/cron/monitor script for the old process name
(`pgrep -f`, `systemctl`, logs). A stale detection pattern silently breaks self-healing.

## Boot restore chain (Termux)

`~/.termux/boot/` is read in alphabetical order by the Termux:Boot app:

1. `01-lailaba-server` — **intentional no-op** (exits 0). It used to `exec uvicorn …` which BLOCKED
   forever and prevented `02-hermes-startup` from ever running. Do not put an `exec` server here.
2. `02-hermes-startup` — acquires wake lock, waits 10s for network, then spawns tmux sessions:
   - `hermes-gateway` (the gateway itself)
   - `hermes-gateway-watch` (the self-heal loop, via `hermes-gateway-watch.sh`)
   - `boot-start-services` → `~/.local/bin/start-services.sh` (network wait up to 120s)
       → `~/.local/bin/service-manager.sh` (sshd + `lailaba-server`:8000 + `hermes-dashboard`:9119)

The gateway-watch also has a PID-file singleton (`~/.local/logs/hermes-gateway-watch.pid`) so the
boot-file path and the tmux path can't double-run the loop.

## ipwatchdog

Runs every 2m as a `lailaba cron` no_agent script job (`~/.lailaba/scripts/ipwatchdog.sh` — scripts
MUST live in `~/.lailaba/scripts/`; the cron tool rejects absolute/`~`-relative paths elsewhere).
It reads the active `ccmni*` IP, and if it changed, rewrites `~/lailaba-ai/.env` `BASE_URL=` and
`~/.local/state/network_info.json`. Keeps LAN URLs correct as the carrier rotates the private IP.

## "address already in use" on restart

`service-manager.sh` guards with `tmux has-session -t lailaba-server` — it does NOT check whether a
live listener holds `:8000`. If a stale uvicorn is still bound (e.g. a previous manual launch that
outlived its tmux session), the managed instance logs `ERROR: [Errno 98] address already in use` and
exits, leaving the tmux session "present" but no server. Always kill stale uvicorn PIDs first:

```bash
pkill -f "uvicorn app.main:app --host 0.0.0.0 --port 8000"
# or: kill <pid> from  pgrep -af "uvicorn app.main"
```
