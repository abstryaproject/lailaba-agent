# Stable Cloudflare domain on Termux/arm (no wrangler)

## Why
The default Cloudflare Tunnel is a *quick tunnel* — random `*.trycloudflare.com` URL that
rotates every restart. A free, STABLE name (`*.workers.dev`) needs a Cloudflare Worker that
reverse-proxies to the current quick-tunnel URL. `wrangler` cannot run here (workerd has no
Android/arm binary → `Unsupported platform: android arm LE`), so everything below uses the
REST API (`curl`).

## Architecture
- `cloudflared` quick tunnel → `localhost:8000` (rotating URL, written to
  `~/.local/tmp/cloudflared-current-url.txt`).
- A CF Worker (`~/cloudflare-worker/worker.js`) reads key `TUNNEL_URL` from a KV namespace
  (`TUNNEL`) and proxies every request to it. Users hit the stable
  `https://lailaba-ai.<sub>.workers.dev`.
- `~/.local/bin/cloudflared-keepalive-stable.sh` keeps the tunnel up AND, on every URL change,
  PUTs the new URL into the KV namespace via REST. So the stable name never goes dead.

## User prereqs (cannot be done by the agent — needs a browser)
1. Free CF account: https://dash.cloudflare.com/sign-up
2. My Profile → API Tokens → Create Token, scopes:
   Account: `Workers Scripts:Edit`, `Workers KV Storage:Edit`, `Account Settings:Read`.
3. Copy the token + Account ID (dashboard right sidebar).

## Deploy (one-shot, after token is set)
```bash
export CF_API_TOKEN="<token>"
export CF_ACCOUNT_ID="<id>"
bash ~/.local/bin/deploy-stable-domain.sh
```
The script does (all via REST):
- `POST /accounts/{acct}/storage/kv/namespaces`  body `{"title":"TUNNEL"}` → capture `id`,
  save to `~/.cloudflared/kv_namespace_id`.
- `PUT  /accounts/{acct}/storage/kv/namespaces/{kv}/values/TUNNEL_URL`  --data "$URL".
- `PUT  /accounts/{acct}/workers/scripts/lailaba-ai`  multipart:
  `worker.js` (file, application/javascript) + `metadata` (file, application/json) where
  metadata = `{"main_module":"worker.js","bindings":[{"type":"kv_namespace","name":"TUNNEL","namespace_id":"<kv>"}]}`.
- Kill tmux `cloudflare`, relaunch with `cloudflared-keepalive-stable.sh`.

## Keepalive KV publish (REST, inside the stable script)
```bash
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$KV_ID/values/TUNNEL_URL" \
  -H "Authorization: Bearer $CF_API_TOKEN" --data "$URL"
```
(Requires `CF_API_TOKEN`, `CF_ACCOUNT_ID`, and `KV_ID` exported in the tmux session's env —
set them in the boot chain or source a small env file before launching.)

## Verify
`curl -s -o /dev/null -w "%{http_code}" https://lailaba-ai.<sub>.workers.dev/health` → 200.
The `<sub>` is in the `workers/scripts` response or dashboard → Workers.

## Caveat
`*.workers.dev` is a free stable name, NOT a custom branded domain (lailaba.link). A truly
custom domain still needs a bought domain added to Cloudflare; the Worker proxy already
supports that upgrade (point a DNS record at the Worker).
