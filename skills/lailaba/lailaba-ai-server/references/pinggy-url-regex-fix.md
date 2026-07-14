# Pinggy free-tier URL regex — CORRECTION

The bundled `pinggy-tunnel` skill's parse step uses:

```
grep -oE 'https://[a-z0-9-]+\.[a-z]+\.pinggy\.link' ...
```

**This is WRONG for the free tier** and matches nothing. Pinggy's free-tier public
domains are:

- `https://<sub>.free.pinggy.net`
- `https://<sub>.run.pinggy-free.link`
- `http://<sub>.free.pinggy.net`
- `http://<sub>.run.pinggy-free.link`

(There is no `*.pinggy.link` host on free tier.)

## Correct regex

```bash
HTTPS=$(grep -oE 'https://[a-z0-9.-]+\.(pinggy\.net|pinggy-free\.link)' "$LOG" | head -1)
HTTP=$( grep -oE 'http://[a-z0-9.-]+\.(pinggy\.net|pinggy-free\.link)' "$LOG" | head -1)
```

Verified live 2026-07-13: tunnel to localhost:8000 returned
`https://bcmpu-105-113-17-112.free.pinggy.net` and `200` on `GET /`
through a CGNAT mobile-data connection.

## Other free-tier gotchas (not in the bundled skill)
- **60-min hard cap.** SSH session dies at 60m; URL goes dead. Free URL is random and
  changes every restart — don't bookmark.
- **One concurrent free tunnel per source IP.** Starting a 2nd kills the 1st.
- **Bare HTTP tunnel = open to anyone with the URL.** For a private service, gate it via the
  ssh username: `b:user:pass` (HTTP basic) or `w:CIDR` (IP allowlist), e.g.
  `"b:admin:secret+free@a.pinggy.io"`.
- `ss -p` / `netstat` are unreliable on this Termux build — verify the tunnel with
  `curl -s -o /dev/null -w "%{http_code}\n" "$HTTPS/"` (expect 200), not socket tools.
