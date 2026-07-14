# Debugging "certificate error" through a Cloudflare quick tunnel

## Facts (verified this session)
- Cloudflare auto-provisions a valid cert for `*.trycloudflare.com`:
  `CN=trycloudflare.com`, issuer `Google Trust Services / WE1`.
- `openssl s_client` + `curl -v` both report `SSL certificate verified` / `cert_verify=0`,
  TLS 1.3. The edge cert is trusted — there is NO real TLS failure.

## The `cert.pem` red herring
Running `cloudflared tunnel --name <x> --url ...` (to try to force a subdomain) FAILS with:
`ERR Cannot determine default origin certificate path. No file cert.pem in [...]`.
This is Cloudflare's **tunnel-auth** cert (only needed for named/account tunnels via
`cloudflared login`). It is NOT the browser-facing TLS cert. Do not confuse the two, and
do not tell the user the tunnel's SSL is broken because of it.

## Real causes of a browser cert/SSL warning (in order of likelihood)
1. **Opened `http://` not `https://`.** Always use the `https://*.trycloudflare.com` URL.
2. **Stale browser cache** from a previous tunnel (e.g. old Pinggy cert/error). Hard-refresh
   (Cmd/Ctrl+Shift+R) or clear cache.
3. **Strict extension** pinning certs (HTTPS Everywhere / cert pinning) flagging the pooled cert.
4. **CORS / mixed content from the app.** If the served page fetches an absolute `http://` URL
   or a different origin, the browser blocks it and it *looks* like a security/cert error.
   - Fix: make the app use **relative** URLs (`/api/...`, not `http://localhost:8000/api/...`),
     and add the tunnel origin to the CORS allow-list.
   - This session: FastAPI `CORS_ORIGINS` was hardcoded to localhost; added
     `https://<sub>.trycloudflare.com` to `app/core/config.py` and restarted the server.
     (JS used relative URLs already, so same-origin was fine — the CORS addition is a safety net.)

## Diagnostic to run
```bash
U=$(cat ~/.local/tmp/cloudflared-current-url.txt)
curl -sS -o /dev/null -w "page=%{http_code} cert_verify=%{ssl_verify_result}\n" --max-time 15 "$U/"
# page=200 cert_verify=0  => tunnel+TLS healthy; the browser issue is client-side/cache/CORS
```
If `cert_verify=0` but the user still sees an error, ask for the **exact browser text**:
`NET::ERR_CERT_AUTHORITY_INVALID` / `ERR_SSL_PROTOCOL_ERROR` / "Your connection is not private".
That string pinpoints the real cause.
