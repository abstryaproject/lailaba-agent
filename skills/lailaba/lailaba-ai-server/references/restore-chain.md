# Boot / auto-restore chain + watchdog map

## Termux:Boot chain (fires on device reboot)
Termux:Boot runs every executable in `~/.termux/boot/` in alphabetical order:

- `01-lailaba-server` — **intentionally a no-op**. It used to `exec uvicorn ...` which BLOCKED
  forever and prevented `02-hermes-startup` (the gateway) from ever running. Do NOT restore the
  `exec` form.
- `02-hermes-startup` — waits 10s for network, then:
  - starts gateway in tmux `hermes-gateway-watch`
  - starts the gateway self-heal watchdog in tmux `hermes-gateway-watch`
    (`~/.local/bin/hermes-gateway-watch.sh`, PID-file singleton at
    `~/.local/logs/hermes-gateway-watch.pid`)
  - starts tmux `boot-start-services` → `~/.local/bin/start-services.sh`

`start-services.sh` waits up to 120s for a network interface, then calls
`service-manager.sh`, which starts: sshd, `lailaba-server` (tmux, :8000),
`hermes-dashboard` (tmux, :9119).

## Watchdogs
- **Gateway healer** `hermes-gateway-watch.sh`: loops; if `pgrep -f "lailaba gateway"` finds
  nothing, `nohup lailaba gateway run &`. Logs `~/.local/logs/gateway-watch.log`.
  REBRAND FIX: pattern was `"hermes.*gateway run"` (pre-rename) → now must be
  `"lailaba gateway"`, else it spawns duplicate gateways.
- **ipwatchdog** `ipwatchdog.sh`: reads the ccmni mobile-data IP, and if it changed, rewrites
  `~/lailaba-ai/.env` BASE_URL + `~/.local/state/network_info.json`. Runs as a `cronjob`
  every 2m. It is NOT auto-created on boot — recreate after a wipe.

## Recreate the ipwatchdog cronjob
The `cronjob` tool requires the script live in `~/.lailaba/scripts/` (absolute/home paths are
rejected). The script already exists at `~/.local/bin/ipwatchdog.sh`; copy it:
```bash
mkdir -p ~/.lailaba/scripts
cp ~/.local/bin/ipwatchdog.sh ~/.lailaba/scripts/ipwatchdog.sh
```
Then (via the cronjob tool): `create` with `schedule="every 2m"`, `no_agent=true`,
`script="ipwatchdog.sh"`, `deliver="local"`.

## Manual one-shot start (no reboot)
```bash
tmux has-session -t lailaba-server 2>/dev/null || tmux new-session -d -s lailaba-server -x 200 -y 50
tmux send-keys -t lailaba-server "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info" Enter
```
NOTE: the service-manager guard checks only `tmux has-session lailaba-server`, not a live
listener. Kill any stale uvicorn on :8000 first or the managed instance dies with
"address already in use".
