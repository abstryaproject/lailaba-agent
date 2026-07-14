---
name: cloudflared-tunnel
description: Expose a local service through Cloudflare Tunnel (cloudflared) — install on Termux/arm, quick-tunnel test + verify, permanent keepalive + boot integration, and the cert-vs-CORS debugging trap. Use when the user wants public access behind CGNAT or to replace pinggy/ngrok.
version: 0.1.0
author: Lailaba AI + Abdullahi Ibrahim
license: MIT
platforms: [linux, android, termux]
metadata:
  lailaba:
    tags: [Cloudflare, Tunnel, cloudflared, Networking, Reverse Tunnel, Public Access, CGNAT]
    related_skills: [pinggy-tunnel, lailaba-termux-services, lailaba-termux-stack]
---

# Cloudflare Tunnel (cloudflared) Skill

Reverse tunnel through Cloudflare's edge — exposes a local service (e.g. `localhost:8000`)
to the public internet without port-forwarding, working through CGNAT / mobile data.
Backed by Cloudflare's global network; the free **quick tunnel** needs no account.

## When to Use
- User wants public access to a local server behind CGNAT / mobile data (no public IP on the device).
- User asks to "expose this", "get a public URL", "make it reachable from anywhere", or names Cloudflare Tunnel.
- User wants to **replace pinggy/ngrok/localtunnel** with a Cloudflare-backed tunnel.

Prefer this over `pinggy-tunnel` when the user wants Cloudflare's network, or when pinggy's
60-min cap / random URL is objectionable. A *named* tunnel (stable custom domain) still requires
a Cloudflare account + a domain you own (see Pitfalls).

## Prerequisites
- `cloudflared` on PATH. On Termux/Android (arm/armv7l): `pkg install -y cloudflared`
  (repo package exists, e.g. `cloudflared/stable 2026.6.1 arm`). Verified working on armv7l.
- A local service listening on `localhost:<port>` (e.g. `127.0.0.1:8000`). The tunnel returns
  URLs but 502s until the origin is up.
- No account needed for quick tunnels.

## Procedure — Quick Tunnel, Verify, Make Permanent

### 1. Install + confirm origin up
```bash
pkg install -y cloudflared
cloudflared version
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/   # expect 200
```

### 2. Launch a quick tunnel (background) and parse the URL
Use `terminal(background=true)` — the process is long-lived. Redirect to a logfile; `process(action='log')`
may miss the banner, so `grep` the file directly.
```bash
LOG=~/.local/tmp/cloudflared-quick.log
cloudflared tunnel --url http://localhost:8000 --no-autoupdate 2>&1 | tee "$LOG"
```
Wait ~10-15s, then:
```bash
URL=$(grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' "$LOG" | head -1)
curl -s -o /dev/null -w "%{http_code}\n" --max-time 15 "$URL/"   # expect 200
```

### 3. Make it permanent (keepalive + boot)
Quick tunnels die on exit; for 24/7 access use a self-restarting loop. Copy
`scripts/cloudflared-keepalive.sh` to `~/.local/bin/`, `chmod +x`, launch in tmux, and wire into
the boot chain (see `devops/lailaba-termux-services` / `service-manager.sh`). The script writes the
current URL to `~/.local/tmp/cloudflared-current-url.txt`.
```bash
tmux new-session -d -s cloudflare "bash ~/.local/bin/cloudflared-keepalive.sh"
```
Boot integration snippet (check the tmux session, NOT a process name, to avoid pkill self-match):
```bash
CLOUDFLARED_TMUX="cloudflare"
if ! tmux has-session -t "$CLOUDFLARED_TMUX" 2>/dev/null; then
  tmux new-session -d -s "$CLOUDFLARED_TMUX" "bash $HOME/.local/bin/cloudflared-keepalive.sh"
fi
```

### 4. Verify
```bash
U=$(cat ~/.local/tmp/cloudflared-current-url.txt)
curl -s -o /dev/null -w "$U -> %{http_code}\n" --max-time 15 "$U/"
curl -s -o /dev/null -w "$U/admin -> %{http_code}\n" --max-time 15 "$U/admin"
```

## Stable free *.workers.dev domain (no owned domain)
A quick tunnel's `*.trycloudflare.com` subdomain **rotates on every restart** (see Pitfalls).
For a FREE, STABLE name without buying a domain, front the quick tunnel with a
**Cloudflare Worker** on a `*.workers.dev` hostname. The Worker reverse-proxies to
the current (rotating) tunnel URL, which the on-device keepalive publishes to a
KV namespace on every restart. Users always hit the stable name; the Worker
forwards to whatever the tunnel URL is right now.

- **Requires:** a FREE Cloudflare account + ONE interactive `wrangler login`
  (opens a browser — the agent CANNOT do this step for the user).
- **Architecture:** `lailaba-ai.<sub>.workers.dev` (Worker) → KV key `TUNNEL_URL`
  → current `*.trycloudflare.com` → `localhost:8000`.
- **Known-good files** (this deploy, 2026-07-14): `templates/worker-stable-proxy.js`,
  `templates/wrangler-stable.toml`, `templates/cloudflared-keepalive-stable.sh`.
- **Deploy sequence (user runs after `wrangler login`):**
  ```bash
  wrangler kv namespace create TUNNEL          # copy the id it prints
  echo "<id>" > ~/.cloudflared/kv_namespace_id
  cd ~/cloudflare-worker && wrangler deploy     # name -> lailaba-ai.<sub>.workers.dev
  # then swap the boot chain to the -stable keepalive (see template), relaunch tmux cloudflare
  ```
- **Caveat:** this is a `*.workers.dev` name, NOT a custom branded domain
  (that still needs an owned domain + DNS). The Worker proxy already supports a
  custom domain later — just point a DNS record at the Worker. Full recipe +
  the KV-publish loop in `references/stable-domain-workers-dev.md`.

## Pitfalls

- **Quick-tunnel subdomain is RANDOM and rotates on every restart.** Cloudflare assigns
  `*.trycloudflare.com` server-side; there is **no flag** to pick it. `--name <x>` does NOT name a
  quick tunnel — it fails with `Cannot determine default origin certificate path` (needs `cert.pem`
  from `cloudflared login`). So `https://lailaba.trycloudflare.com` / `https://ai.trycloudflare.com`
  are **impossible** to force. A chosen name requires: (1) register a domain, (2) add to Cloudflare
  (free), (3) `cloudflared login` → `cert.pem`, (4) `cloudflared tunnel create <name>`, (5) DNS route
  `ai.<yourdomain>`, (6) run `cloudflared tunnel run <name>`. Only then do you get a stable
  `https://lailaba.<yourdomain>`.

- **"Certificate error" through the tunnel is usually NOT a TLS error.** Cloudflare auto-provisions a
  valid cert (`CN=trycloudflare.com`, issued by Google Trust Services / WE1), verified by OpenSSL,
  TLS 1.3 — zero errors. If the browser shows a cert/SSL warning, the real cause is almost always:
  (a) opening `http://` instead of `https://`; (b) **stale browser cache** from a previous tunnel
  (hard-refresh / clear cache); (c) a strict extension pinning certs; or (d) **CORS / mixed content**
  from the app — see `references/debugging-cert-vs-cors.md`. The `cert.pem` error from `--name` is
  Cloudflare's *tunnel-auth* cert, completely separate from the browser-facing TLS cert — do not
  confuse them.

- **Never leave a reachability gap during a tunnel switch.** When replacing pinggy with cloudflared:
  start + VERIFY cloudflared first, only then kill pinggy (`tmux kill-session -t pinggy`, remove the
  keepalive script, `pkill -9 -f "[f]ree@a.pinggy.io"` bracket trick to avoid self-match). Confirm
  `pgrep -f "[f]ree@a.pinggy.io"` is empty before declaring done.

- **Serveo is unreliable** — its SSH relay closes connections immediately in practice (server-side).
  Don't rely on it for a chosen free subdomain.

- **Cloudflare quick-tunnel terms**: "no uptime guarantee", account-less tunnels can be investigated
  for ToS violations. Fine for personal use, not a production SLA.

## Verification
End-to-end proof the tunnel works (the gate before deleting any old tunnel):
```bash
U=$(cat ~/.local/tmp/cloudflared-current-url.txt)
curl -sS -o /dev/null -w "page=%{http_code} cert_verify=%{ssl_verify_result}\n" --max-time 15 "$U/"
# expect page=200, cert_verify=0
```
`cert_verify=0` confirms the TLS chain is trusted — if the user still reports a browser cert error
after a hard-refresh on `https://`, ask for the EXACT browser text (NET::ERR_CERT_AUTHORITY_INVALID /
ERR_SSL_PROTOCOL_ERROR / "Your connection is not private") to pinpoint it.
