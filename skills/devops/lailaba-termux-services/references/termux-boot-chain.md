# Termux boot & watchdog chain (condensed)

## Boot entry points
`~/.termux/boot/` is run alphabetically by Termux:Boot on device boot.

### `01-lailaba-server` — INTENTIONAL NO-OP
Used to `exec uvicorn ...` which BLOCKED forever and prevented `02-hermes-startup`
(the gateway) from running. Do NOT restore the exec form here.

### `02-hermes-startup`
- `termux-wake-lock` (keep Termux alive in background)
- `sleep 10` for network
- gateway → tmux `hermes-gateway`: `cd $HOME && exec $HERMES_BIN gateway run`
- gateway watch → tmux `hermes-gateway-watch`: `~/.local/bin/hermes-gateway-watch.sh`
- service manager → tmux `boot-start-services`: `~/.local/bin/start-services.sh`
- best-effort Telegram proof-of-life via `lailaba send`

## `start-services.sh` → `service-manager.sh`
`service-manager.sh` starts (all guarded by `tmux has-session`):
- sshd (if not running)
- tmux `lailaba-server`: `cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`
- tmux `hermes-dashboard`: `lailaba dashboard --port 9119 --host 0.0.0.0 --no-open --skip-build`

## `hermes-gateway-watch.sh` (gateway self-heal)
- PID-file singleton guard (`~/.local/logs/hermes-gateway-watch.pid`) → no double loops.
- Loop: `pgrep -f "lailaba gateway" || nohup lailaba gateway run &` then sleep 60 (15 if it had to restart).
- **REBRAND FIX (applied this session):** original pattern was `"hermes.*gateway run"`.
  After hermes→lailaba binary rename the real process is `lailaba gateway`, so the old
  pattern never matched and the watchdog spawned a duplicate gateway every 60s.
  Changed to `pgrep -f "lailaba gateway"`.

## `ipwatchdog.sh` (IP watchdog)
- Runs as cronjob every 2m.
- Reads current IP from `ccmni` interface; if changed, rewrites `~/lailaba-ai/.env` BASE_URL
  and `network_info.json` (`{interface, ip, ssh_port:8022, lailaba_url:…:8000, hermes_dashboard_url:…:9119}`).
- Must be copied to `~/.lailaba/scripts/ipwatchdog.sh` for the cron tool (absolute paths rejected).
