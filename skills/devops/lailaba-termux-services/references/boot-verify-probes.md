# Boot & service verification probes (Termux / Lailaba)

Used to confirm the full stack actually came up after a boot or a manual
`bash ~/.local/bin/service-manager.sh` run — NOT just that the log said
"Started X". Several services are non-HTTP, so the probe tool differs per port.

## HTTP services → `curl` (read the status code)
- Lailaba FastAPI `:8000`  → expect `200`
- Dashboard `:9119`        → expect `302` (redirect to login); that is HEALTHY, not an error
- Gateway usually exposes no HTTP listener → verify via `ps` (below), not curl

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 http://127.0.0.1:8000/
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 http://127.0.0.1:9119/
```

## sshd `:8022` → `curl` is WRONG (returns `000`, not down)
sshd is not an HTTP server. A `000` from curl on 8022 means nothing about
sshd's health. Probe the port with `nc` (or bash `/dev/tcp`) and confirm the
process:

```bash
nc -z -w3 127.0.0.1 8022 && echo "sshd LISTENING on 8022" || echo "DOWN"
pgrep -x sshd && echo "sshd proc present"
# fallback if nc is missing:
timeout 3 bash -c 'cat < /dev/tcp/127.0.0.1/8022' 2>/dev/null | head -c 40   # prints SSH banner if up
```

## Gateway / long-lived procs → `ps` (not curl)
```bash
ps -eo pid,args | grep -E "[l]ailaba gateway|[u]vicorn app.main|[l]ailaba dashboard" | head
tmux ls   # expect: hermes-gateway, hermes-gateway-watch, lailaba-server, hermes-dashboard, (lailaba-lab if labserve.py present)
```

## Recommended end-to-end check (run AFTER `bash ~/.local/bin/service-manager.sh`)
1. `sleep 6` — let uvicorn + dashboard bind.
2. probe `8000` (expect 200), `9119` (expect 302), `8022` via `nc`, and `ps` for the gateway.
3. `tmux capture-pane -t hermes-dashboard -p | tail` to confirm the dashboard finished serving.

Gotcha: dashboard returns `302` for both `/` and `/health` — that is normal,
not a failure. A `000` on 8022 is a curl artifact, not an sshd outage.
