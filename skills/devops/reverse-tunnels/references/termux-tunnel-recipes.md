# Termux tunnel keepalive + boot wiring recipes

## Cloudflare keepalive script (`~/.local/bin/cloudflared-keepalive.sh`)

```bash
#!/usr/bin/env bash
LOG=~/.local/tmp/cloudflared-quick.log
URLFILE=~/.local/tmp/cloudflared-current-url.txt
mkdir -p ~/.local/tmp
echo "[$(date)] keepalive started (pid $$)" >> "$LOG"
while true; do
  echo "[$(date)] starting cloudflared tunnel" >> "$LOG"
  cloudflared tunnel --url http://localhost:8000 --no-autoupdate > "$LOG" 2>&1 &
  CF_PID=$!
  URL=""
  for _ in $(seq 1 30); do
    sleep 1
    URL=$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
    [ -n "$URL" ] && break
  done
  [ -n "$URL" ] && echo "$URL" > "$URLFILE"
  wait "$CF_PID"
  echo "[$(date)] tunnel exited, restarting in 3s" >> "$LOG"
  sleep 3
done
```

Launch: `tmux new-session -d -s cloudflare "bash ~/.local/bin/cloudflared-keepalive.sh"`
Verify: `curl -s -o /dev/null -w "%{http_code}\n" "$(cat ~/.local/tmp/cloudflared-current-url.txt)/"`

## Pinggy keepalive (free tier, 60-min cap) — `~/.local/bin/pinggy-keepalive.sh`

Replace the cloudflared line with:
```bash
ssh -p 443 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
    -R0:localhost:8000 free@a.pinggy.io > "$TMP" 2>&1 &
```
Parse URL with: `grep -oE 'https://[a-z0-9.-]+\.(pinggy\.net|pinggy-free\.link)'`

## Boot wiring into `service-manager.sh` (Termux boot chain)

Add after the Lailaba-server block. Check the **tmux session**, never a process name (avoids pkill self-match):
```bash
CLOUDFLARED_TMUX="cloudflare"
if ! tmux has-session -t "$CLOUDFLARED_TMUX" 2>/dev/null; then
    tmux new-session -d -s "$CLOUDFLARED_TMUX" "bash $HOME/.local/bin/cloudflared-keepalive.sh"
    log "Started Cloudflare keepalive tunnel (tmux: $CLOUDFLARED_TMUX)"
else
    log "Cloudflare tunnel already running in tmux:$CLOUDFLARED_TMUX"
fi
```

## Safe teardown of the old provider
```bash
tmux kill-session -t pinggy                 # kill old tunnel session
rm -f ~/.local/bin/pinggy-keepalive.sh \
      ~/.local/tmp/pinggy-8000.log ~/.local/tmp/pinggy-8000.pid ~/.local/tmp/pinggy-current-url.txt
pkill -9 -f "[f]ree@a.pinggy.io"            # bracket trick: avoid self-match
# residual check:
pgrep -f "[f]ree@a.pinggy.io" >/dev/null && echo STILL_RUNNING || echo CLEAN
```

## Verify order during migration
1. New tunnel (cloudflared) returns 200 on `/` and `/admin`.
2. Old tunnel killed + no residual process.
3. New tunnel STILL 200 after teardown.
Only then is the migration complete.
