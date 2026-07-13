# Gateway wedged in a Telegram reconnect loop (httpx.ConnectError)

## Symptom
`lailaba status` still reports `◆ Gateway Service: ✓ running` (PID alive), but the
gateway log is a repeating stack ending in:

    httpx.ConnectError: All connection attempts failed

and earlier lines show:

    Primary api.telegram.org connection failed ([Errno 7] No address associated with hostname); trying fallback IPs 149.154.166.110
    Fallback IP 149.154.166.110 failed: All connection attempts failed

Other observed variants: `httpx.ReadError`, `ERROR telegram.ext.Updater: Error while
calling get_updates ... Suppressing error`. The `process` tool's `watch_patterns`
("ERROR"/"Traceback"/"http") will fire repeatedly on this noise.

## Diagnosis — confirm it's a wedged pool, not a real outage
A fresh connection from a NEW process usually works even while the gateway is stuck.
This mismatch is the signature that the gateway's long-lived httpx socket pool has
wedged (classic mobile-carrier flapping on Telegram's IP):

    # from a fresh shell / python, NOT the gateway process:
    ~/.hermes/hermes-agent/venv/bin/python -c "import socket; socket.create_connection(('api.telegram.org',443),timeout=8); print('OK')"
    curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 https://api.telegram.org/
    # ^ these normally succeed (200 / OK) even while the gateway logs ConnectError

Also check: `grep -iE "proxy|telegram|api_url" ~/.lailaba/.env` — verify there is no
stale HTTP proxy / custom api_root forcing the wrong endpoint. If DNS resolves and a
fresh connect works, the gateway's pool is the problem, not the network.

## Fix
Restart the gateway to drop the wedged pool and open fresh connections. The `process`
kill action hits a self-termination guard on the lailaba wrapper shell, so kill by
pattern in terminal:

    pkill -9 -f "lailaba gateway"
    sleep 2
    lailaba status   # confirm stopped

Then relaunch in background and verify it connects cleanly (no ConnectError in the
first ~20s, `lailaba status` -> running). In-session, a restart moved the gateway
from a 500s+ ConnectError spam loop to a clean, error-free run.

## Notes
- This is usually transient. A single `get_updates` poll error does NOT mean the
  gateway is dead — only act when the error repeats continuously (a tight loop) and a
  fresh connect from another process succeeds.
- On mobile networks (Termux on Android) Telegram's IP can flap; treat periodic
  restart as a reasonable recovery path rather than hunting a permanent config fix.
