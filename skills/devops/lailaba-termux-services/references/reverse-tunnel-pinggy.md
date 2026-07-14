# Reverse tunnel over Pinggy (overcome CGNAT on Termux)

## The problem symptom
Browser on another device shows:
`ERR_CONNECTION_ABORTED` hitting `http://<public-ip>:8000/`.
Root cause: the "public" IP (e.g. `105.113.17.112`) is the **ISP's carrier-grade NAT gateway**, NOT a local interface. Confirm with:
```bash
ip -4 addr show | grep "inet "          # phone's real IP is private e.g. 10.72.183.139
# 105.113.17.112 will NOT appear on any local interface
```
Port-forwarding through CGNAT from a phone on mobile data is impossible. Fix = reverse tunnel.

## Keepalive script (~/.local/bin/pinggy-keepalive.sh)
```bash
#!/usr/bin/env bash
LOG=~/.local/tmp/pinggy-keepalive.log
TMP=~/.local/tmp/pinggy-keepalive.tmp
URLFILE=~/.local/tmp/pinggy-current-url.txt
mkdir -p ~/.local/tmp
echo "[$(date)] keepalive started (pid $$)" >> "$LOG"
while true; do
  echo "[$(date)] starting tunnel" >> "$LOG"
  ssh -p 443 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
      -R0:localhost:8000 free@a.pinggy.io > "$TMP" 2>&1 &
  SSHPID=$!
  URL=""
  for _ in $(seq 1 30); do
    sleep 1
    URL=$(grep -oE 'https://[a-z0-9.-]+\.(pinggy\.net|pinggy-free\.link)' "$TMP" 2>/dev/null | head -1)
    [ -n "$URL" ] && break
  done
  [ -n "$URL" ] && echo "$URL" > "$URLFILE"
  wait "$SSHPID"
  echo "[$(date)] tunnel exited, restarting in 3s" >> "$LOG"
  sleep 3
done
```

## Launch as a managed service
```bash
chmod +x ~/.local/bin/pinggy-keepalive.sh
tmux new-session -d -s pinggy "bash $HOME/.local/bin/pinggy-keepalive.sh"
```
Add to `service-manager.sh` (boot chain) guarded by `tmux has-session -t pinggy`.

## Verify
```bash
URL=$(cat ~/.local/tmp/pinggy-current-url.txt)
curl -s -o /dev/null -w "GET / -> %{http_code}\n" --max-time 15 "$URL/"
# expect 200
```

## Subdomain / Pro rules (Pinggy)
- **Free tier**: random rotating subdomain, 60-min hard cap, no signup. You CANNOT choose the name.
- **Pro ($3/mo)**: persistent chosen subdomain on Pinggy's domain (e.g. `lailaba.run.pinggy-free.link`), no 60-min cap. Token becomes the SSH username: `ssh -p 443 -R0:localhost:8000 "<TOKEN>@a.pinggy.io"`.
- **Custom domain** (e.g. `lailaba.link`): needs Pro AND you register the domain at a registrar, then point DNS at Pinggy.
- You cannot rename the free URL — if the user wants `lailaba.*`, that's a paid step.

## Pitfalls
- Only ONE free tunnel per source IP — starting a second kills the first. Kill the old one (or its tmux session) before launching a new command-line tunnel.
- URL rotates hourly on free; re-read `~/.local/tmp/pinggy-current-url.txt` rather than memorizing it.
- SSH prints `You are not authenticated / tunnel will expire in 60 minutes` — expected on free.
- The banner domain is `pinggy-free.link` OR `pinggy.net` — grep both (don't hardcode one).
- No password on the tunnel = anyone with the URL reaches your app. Gate with `b:user:pass+` / `k:token+` / `w:CIDR+` username flags if exposing a private service.
