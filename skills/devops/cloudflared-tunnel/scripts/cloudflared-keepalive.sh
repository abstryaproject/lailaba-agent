#!/usr/bin/env bash
# cloudflared-keepalive.sh — keeps a Cloudflare quick tunnel to localhost:8000
# alive forever (auto-restarts if cloudflared exits). Account-less quick tunnel
# => random *.trycloudflare.com URL (rotates on each restart). Current URL is
# written to ~/.local/tmp/cloudflared-current-url.txt for easy lookup.
LOG=~/.local/tmp/cloudflared-quick.log
URLFILE=~/.local/tmp/cloudflared-current-url.txt
mkdir -p ~/.local/tmp
echo "[$(date)] keepalive started (pid $$)" >> "$LOG"

while true; do
  echo "[$(date)] starting cloudflared tunnel" >> "$LOG"
  cloudflared tunnel --url http://localhost:8000 --no-autoupdate > "$LOG" 2>&1 &
  CF_PID=$!

  # wait up to 30s for the trycloudflare URL to appear
  URL=""
  for _ in $(seq 1 30); do
    sleep 1
    URL=$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
    [ -n "$URL" ] && break
  done
  if [ -n "$URL" ]; then
    echo "$URL" > "$URLFILE"
    echo "[$(date)] URL live: $URL" >> "$LOG"
  else
    echo "[$(date)] WARNING: no URL captured this cycle" >> "$LOG"
  fi

  wait "$CF_PID"
  echo "[$(date)] tunnel exited (code $?), restarting in 3s" >> "$LOG"
  sleep 3
done
