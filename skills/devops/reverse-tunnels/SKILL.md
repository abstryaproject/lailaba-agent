---
name: reverse-tunnels
description: Expose a local server (behind CGNAT/NAT/firewall) to the public internet via reverse tunnels — Cloudflare Tunnel, Pinggy, Serveo — on Termux/Android and Linux. Covers CGNAT diagnosis, provider comparison, verified Termux install/run commands, the permanent keepalive pattern, and safe tunnel migration (verify-before-teardown).
version: 0.1.0
author: Lailaba AI
license: MIT
platforms: [linux, android]
metadata:
  lailaba:
    tags: [tunnel, reverse-tunnel, cgnat, cloudflare, pinggy, serveo, ngrok, termux, expose-localhost, public-url]
    related_skills: [pinggy-tunnel, lailaba-termux-services]
---

# Reverse Tunnels (expose a local server publicly)

Use when the user says "make my local server public", "share localhost:8000", "get a public URL", "I can't reach my server via my IP", or "switch tunnel providers" (e.g. "if Cloudflare works, drop Pinggy").

## 1. CGNAT diagnosis — why `http://<public-ip>:<port>` fails on mobile

On a phone on mobile data, the "public IP" you see from `ipify`/`ifconfig.me` is the **ISP's carrier-grade NAT gateway**, not your device. Hitting it returns `ERR_CONNECTION_ABORTED` (gateway resets), not a timeout.

Diagnose in 3 commands:
```bash
curl -s https://api.ipify.org          # the ISP CGNAT IP (e.g. 105.113.17.112)
ip -4 addr show | grep -E "inet "       # device's REAL interfaces (often 10.x / 192.168.x)
# if the ipify IP does NOT appear in `ip -4 addr` -> you're behind CGNAT
```
If behind CGNAT, **no port-forward on the phone will help** — you need an outbound reverse tunnel. That's what this skill is for.

(On Wi-Fi the device usually has a LAN IP like 192.168.x.x; same-LAN browsers can use `http://<lan-ip>:<port>`, but anything off-LAN still needs a tunnel.)

## 2. Provider comparison

| Provider | Cost | Chosen name? | Stable? | Notes |
|---|---|---|---|---|
| Cloudflare quick tunnel | free | ❌ random `*.trycloudflare.com` | ⚠️ rotates on restart | account-less, no uptime SLA; works great on Termux |
| Cloudflare **named** tunnel + your domain | free (need domain ~$10/yr) | ✅ `lailaba.link` | ✅ permanent | needs CF account + `cloudflared tunnel run <name>` |
| Pinggy free | free | ❌ random | ⚠️ 60-min cap | SSH-based, one tunnel per IP |
| Pinggy Pro ($3/mo) | paid | ✅ `lailaba.run.pinggy-free.link` | ✅ | token as SSH username; no cap |
| Serveo | free | ✅ `lailaba.serveo.net` (if free) | ⚠️ | SSH-based; **often down/blocked** |
| localhost.run | free | ❌ random (paid for custom) | ✅ | SSH-based |
| ngrok | freemium | ❌ random free | ⚠️ | account needed |

Rule of thumb: want **free + working now** → Cloudflare quick tunnel. Want **your exact domain name** → buy domain + Cloudflare named tunnel. Want **Pinggy-specific subdomain** → Pinggy Pro.

## 3. Verified Termux/Android commands

**Cloudflare Tunnel (recommended, free, no account):**
```bash
pkg install -y cloudflared          # armv7l 2026.6.1 confirmed present in Termux repos
cloudflared tunnel --url http://localhost:8000 --no-autoupdate
# prints: https://<random>.trycloudflare.com  -> forwards to localhost:8000
```
Verify it reaches your origin: `curl -s -o /dev/null -w "%{http_code}\n" https://<url>/` (expect 200). Connectivity pre-checks PASS on Termux armv7l; only a harmless ICMP ping_group_range warning appears (permission denied, non-fatal).

**Pinggy (SSH, free):**
```bash
ssh -p 443 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -R0:localhost:8000 free@a.pinggy.io
# prints http(s)://<random>.(pinggy.net|pinggy-free.link)
```
(See the `pinggy-tunnel` skill for Pro token syntax, access-control flags, and full recipes.)

**Serveo (SSH) — try only if a free chosen name is wanted; frequently unreachable:**
```bash
ssh -p 443 -R lailaba:80:localhost:8000 serveo.net   # wants lailaba.serveo.net
# if you get "Connection closed by <ip> port 443" -> Serveo is down, fall back to Cloudflare
```

## 4. Make it PERMANENT (Termux)

A one-shot tunnel dies on reboot / hits the 60-min cap. Use a self-restarting tmux keepalive loop and wire it into the boot chain (`service-manager.sh`, called by Termux `start-services.sh` on boot). See `references/termux-tunnel-recipes.md` for the full keepalive script skeleton and boot-wiring snippet. Write the current public URL to a known file (e.g. `~/.local/tmp/cloudflared-current-url.txt`) so it's always discoverable after rotation.

## 5. SAFE migration between providers (the "if" rule)

When the user says "**if** X works, switch and delete Y" — the condition is a real gate, not a suggestion:
1. **Install + test X first.** Launch it, parse its URL, and `curl` it for a 200 against the real origin. Only proceed if it actually works.
2. **Start X's keepalive and re-verify** (200) before touching Y.
3. **Only then tear down Y** — kill its tmux session, remove its keepalive script, and kill any stray process with the `pkill` bracket trick to avoid matching your own shell:
   ```bash
   pkill -9 -f "[f]ree@a.pinggy.io"     # brackets prevent pkill from matching itself
   ```
4. Confirm residual check is CLEAN and X still returns 200.

Never delete the old tunnel while the new one is unverified — that creates a gap where the user is unreachable.

## 6. Pitfalls
- **CGNAT can't be port-forwarded from a phone** — don't waste time on router settings; use a tunnel.
- **Free-tier URLs rotate** (Cloudflare quick + Pinggy free change every restart). Don't bookmark; read the URL file.
- **Pinggy free = 60-min hard cap.** Use the keepalive loop, not a bare `ssh`.
- **pkill self-match** — bare `pkill -f "free@a.pinggy.io"` can match the shell running it. Use `[f]ree@...`.
- **Don't expose unauthenticated admin panels.** A public tunnel is a public attack surface — gate sensitive routes (`b:user:pass` on Pinggy, Cloudflare Access for named tunnels).
- **Cloudflare quick tunnel = "no uptime guarantee"** per their terms; fine for personal use, not a production SLA.
- **Use `terminal(background=true)`, not `nohup ... &`** — Lailaba's runtime rejects shell-level background wrappers; use the tool's background mode for long-lived processes.
