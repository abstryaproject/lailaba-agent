# Stable free *.workers.dev domain over a rotating quick tunnel

## Problem
`cloudflared tunnel --url ...` (quick tunnel) gives a random `*.trycloudflare.com`
URL that ROTATES every restart. Users bookmarking it get a dead link. A chosen
name (`lailaba.trycloudflare.com`) is impossible without an account + owned domain.

## Solution (free, no owned domain)
Keep the quick tunnel for CGNAT punch-through, but put a stable
`*.workers.dev` hostname in front of it via a Cloudflare Worker that
reverse-proxies to the current tunnel URL stored in KV.

```
User ──► lailaba-ai.<sub>.workers.dev (Worker)
                     │  reads KV key TUNNEL_URL
                     ▼
              current *.trycloudflare.com  ──►  localhost:8000
```

The on-device keepalive publishes the new URL to KV within ~15s of every restart,
so the stable name never goes dead.

## Prereqs the agent CANNOT do (needs a browser)
1. Free Cloudflare account: https://dash.cloudflare.com/sign-up
2. `wrangler login` (interactive OAuth in a browser)
3. `wrangler kv namespace create TUNNEL` → copy the namespace id
4. `echo "<id>" > ~/.cloudflared/kv_namespace_id`

## Deploy (user, after login)
```bash
cd ~/cloudflare-worker
wrangler deploy          # stable name printed: lailaba-ai.<sub>.workers.dev
```

## Switch the boot chain to the stable keepalive
Replace the `cloudflare` tmux launch (old quick-tunnel-only script) with
`cloudflared-keepalive-stable.sh`, which (a) keeps the quick tunnel alive and
(b) runs `wrangler kv key put TUNNEL_URL --binding TUNNEL --remote <url>` whenever
the URL changes.

```bash
tmux kill-session -t cloudflare 2>/dev/null
tmux new-session -d -s cloudflare "bash ~/.local/bin/cloudflared-keepalive-stable.sh"
```

## Verify
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lailaba-ai.<sub>.workers.dev/health   # 200
# restart tunnel, wait 20s, curl again -> still 200 (KV propagated)
```

## Why not just a named tunnel?
A named tunnel (`cloudflared tunnel create <name>`) also needs the account cert
+ a domain in Cloudflare. The Worker approach is the only free + stable + no-domain
path. If the user later buys a domain, point DNS at the same Worker — no re-architect.
