---
name: external-access
description: >-
  Expose a locally-running service (Lailaba AI on Termux/Android behind ISP CGNAT)
  to the public internet via reverse tunnel. Covers the option decision matrix
  (Pinggy, Serveo, Cloudflare quick/named, Tailscale), the VERIFIED-WORKING
  Cloudflare quick-tunnel recipe for armv7l / non-rooted Termux (keepalive,
  boot wiring, URL-rotation caveat, fake "cert error" causes), and the Tailscale
  non-PIE dead-end. Use whenever the user wants external/public access to a
  server running on this phone, or asks to switch/shorten/rename the tunnel URL.
---

# External Access (reverse tunneling) for Lailaba on Termux/Android

## Context
Lailaba AI runs on a phone: **Termux, armv7l, ~1.8 GB RAM, NO root, behind ISP
CGNAT**. The phone has a private IP (e.g. `10.x`) and inbound ports are blocked
by CGNAT, so a plain port-forward won't work. You need an **outbound** reverse
tunnel to a public relay. A plain `curl https://api.ipify.org` returns the CGNAT
gateway IP (e.g. `105.113.17.112`) — NOT reachable inbound. `ERR_CONNECTION_ABORTED`
when testing the public IP = CGNAT reset, not a server problem.

## Decision matrix — what actually works on THIS device
| Option | Free? | Stable/custom name? | Works here? | Notes |
|--------|-------|---------------------|-------------|-------|
| Pinggy free | yes | no (random, rotates ~60 min) | ✅ | `ssh -p 443 -R0:localhost:8000 free@a.pinggy.io`; needs keepalive loop |
| Pinggy Pro $3/mo | yes | ✅ `lailaba.run.pinggy-free.link` | ✅ | needs user token |
| Serveo | yes | maybe `lailaba.serveo.net` if free | ❌ | web 200 but SSH relay closes conn immediately — dead/blocked |
| **Cloudflare quick tunnel** | yes | no (random `*.trycloudflare.com`, rotates on restart) | ✅ **verified** | `cloudflared tunnel --url http://localhost:8000` |
| Cloudflare named tunnel | yes (acct + owned domain) | ✅ `lailaba.<yourdomain>` | ✅ | needs `cloudflared login` + domain (~$10/yr at registrar) |
| Tailscale Funnel | yes (acct) | stable `*.ts.net` (or own domain) | ❌ on armv7l | official arm binary is non-PIE; Android linker rejects — see Pitfalls |

**Chosen method: Cloudflare quick tunnel.** User validated it with
*"if Cloudflare Tunnel can work correctly use it and delete pinggy"* → after a
real `200` verification, pinggy was deleted (tmux session killed, keepalive
script + URL file removed, stale `free@a.pinggy.io` ssh killed with bracket
trick `pkill -f "[f]ree@a.pinggy.io"`).

## Working recipe — Cloudflare quick tunnel (Termux)
1. Install: `pkg install -y cloudflared` (Termux repo ships an arm build,
   verified `2026.6.1`).
2. Keepalive script `~/.local/bin/cloudflared-keepalive.sh` (self-restart loop;
   captures the assigned URL to `~/.local/tmp/cloudflared-current-url.txt`).
   See `references/keepalive-script.sh`.
3. Launch: `tmux new-session -d -s cloudflare "bash ~/.local/bin/cloudflared-keepalive.sh"`
4. Boot wiring: in `service-manager.sh`, start the `cloudflare` tmux session
   with `tmux has-session -t cloudflare` guard — **do NOT `pkill cloudflared`**
   (the agent's own command line contains that string → self-match kill).
5. Verify: `curl -s https://<url>/ -> 200`. The browser cert is Cloudflare
   (Google Trust Services), OpenSSL-verified, TLS 1.3 — valid.

## Honest caveats to tell the user
- **Quick-tunnel URL ROTATES on every restart** (reboot or ~60-min edge refresh).
  Current URL is always in `~/.local/tmp/cloudflared-current-url.txt`.
- **No custom name** without a Cloudflare account + an owned domain.
  - `lailaba.trycloudflare.com` / `ai.trycloudflare.com` are **impossible** —
    subdomain is assigned server-side; `--name` only works with a login cert
    (named tunnel) and still requires *your* domain, not `trycloudflare.com`.
- The `cert.pem` error only appears with `--name`/named tunnels (needs login
  cert). It is **NOT** a browser SSL error.
- If the user reports a "certificate error" in the browser, it is almost always:
  (a) opening `http://` instead of `https://`; (b) stale cache from the old
  tunnel (hard-refresh / clear cache); or (c) a strict cert-pinning extension.
  Prove the real cert with `curl -sv <url>` (look for `SSL certificate verified`).

## Pitfalls / dead ends (don't re-litigate)
- **Tailscale on armv7l Android**: official `tailscale_*.arm.tgz` is
  `Type: EXEC` (non-PIE, `e_type=2`). Android's `/system/bin/linker` refuses
  non-PIE since Android 5 → `error: ... has unexpected e_type: 2`.
  Attempted fixes (all failed): `patchelf --set-type DYN` (patchelf 0.18 has no
  `--set-type`); hex-patch `e_type` 02→03 at ELF offset 16 → then
  `.dynamic section header was not found`. arm64 build won't run on an armv7l
  kernel. No Go toolchain in Termux to rebuild PIE. **Conclusion: local
  `tailscaled` cannot run here.** The Play Store *app* (GUI, separate) can give
  tailnet access, but Funnel via a local daemon is out. Keep Cloudflare.
- **Serveo**: site responds 200 but the SSH relay closes the connection
  immediately (`Connection closed by 5.255.123.12 port 443`). Effectively down.
- **`pkill` self-match**: never `pkill cloudflared` from a command that contains
  that string; use `pkill -f "[c]lfd"` or check the tmux session instead.
- **`/tmp` is read-only** on this device — use `~/.local/tmp` for temp files.

## Related skills
Complements `devops/cloudflared-tunnel` and `devops/reverse-tunnels` (overlap —
curator may consolidate). This skill adds the Termux/armv7l/CGNAT specifics,
the option decision matrix, and the Tailscale dead-end that those may lack.
