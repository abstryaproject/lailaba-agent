#!/usr/bin/env bash
# cloudflared-keepalive.sh (STABLE DOMAIN edition)
# 1. Keeps a Cloudflare quick tunnel to localhost:8000 alive forever.
# 2. Publishes the current rotating tunnel URL into the Cloudflare Worker KV
#    (binding TUNNEL) so the stable *.workers.dev name always forwards to it.
# When cloudflared restarts and gets a new URL, the Worker is updated within
# ~15s, so users hitting the stable name never see a dead link.
#
# Requires: `wrangler login` done once (free CF account). The KV namespace ID
# is read from ~/.cloudflared/kv_namespace_id (set by deploy script) or env.
LOG=~/.local/tmp/cloudflared-stable.log
URLFILE=~/.local/tmp/cloudflared-current-url.txt
KV_ID_FILE=~/.cloudflared/kv_namespace_id
mkdir -p ~/.local/tmp

echo "[$(date)] stable keepalive started (pid $$)" >> "$LOG"

PUBLISH_KV=1
if [ -f "$KV_ID_FILE" ]; then
  KV_ID=$(cat "$KV_ID_FILE")
else
  KV_ID="${LAILABA_KV_ID:-}"
fi
[ -z "$KV_ID" ] && PUBLISH_KV=0

publish_url() {
  [ "$PUBLISH_KV" -eq 0 ] && return 0
  if command -v wrangler >/dev/null 2>&1; then
    wrangler kv key put TUNNEL_URL --binding TUNNEL --remote "$1" >> "$LOG" 2>&1 \
      && echo "[$(date)] KV updated -> $1" >> "$LOG" \
      || echo "[$(date)] KV UPDATE FAILED for $1" >> "$LOG"
  else
    echo "[$(date)] wrangler missing; cannot publish to KV" >> "$LOG"
  fi
}

while true; do
  echo "[$(date)] starting cloudflared tunnel" >> "$LOG"
  cloudflared tunnel --url http://localhost:8000 --no-autoupdate > "$LOG" 2>&1 &
  CF_PID=$!

  URL=""
  for _ in $(seq 1 40); do
    sleep 1
    URL=$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1)
    [ -n "$URL" ] && break
  done
  if [ -n "$URL" ]; then
    echo "$URL" > "$URLFILE"
    echo "[$(date)] URL live: $URL" >> "$LOG"
    publish_url "$URL"
  else
    echo "[$(date)] WARNING: no URL captured this cycle" >> "$LOG"
  fi

  wait "$CF_PID"
  echo "[$(date)] cloudflared exited; restarting in 3s" >> "$LOG"
  sleep 3
done
