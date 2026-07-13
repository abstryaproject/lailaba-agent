# Termux service process-kill & liveness verification

Condensed from a real restart session (uvicorn :8000 + labserve :8080 + gateway).
Use these recipes whenever you stop/restart any long-lived service on this Termux host.

## Kill a service WITHOUT killing your own shell
`pkill -f` matches the FULL command line of every process — including the bash
running your pkill command. A pattern like `pkill -9 -f "app.main:app"` matches its
own `bash -c '... pkill -9 -f "app.main:app" ...'` and kills the shell before the
target → target survives, command returns `exit_code: -9`.

SAFE forms (pick one):
- Bracket trick — the regex can't match its own cmdline:
  `pkill -9 -f "[u]vicorn app.main:app"`
  `pkill -9 -f "[l]ab/runtime/labserve.py"`
- Kill by exact PID:
  `PID=$(ps -eo pid,args | grep "[u]vicorn app.main:app" | awk '{print $1}'); kill -9 $PID`
- For `exec`-launched tmux services, prefer the bracket trick over
  `tmux send-keys C-c` (C-c terminates the whole tmux session, not just the worker).

## Verify liveness — `ss`/`netstat` are UNRELIABLE here
On this Termux build `ss -ltn` returned empty/"ports free" even though the ports
were actually LISTENING. Trust `curl` + `ps` instead:
- `curl -s -o /dev/null -w "8000=%{http_code}\n" http://127.0.0.1:8000/`
- `ps -eo pid,args | grep -E "[u]vicorn app.main:app|[l]ab/runtime/labserve.py" | awk '{print $1}'`
- `pgrep -af "lailaba gateway" | grep -v pgrep` for the gateway.

## Phantom background-process watch notifications
When you kill an old service and spawn a new one, the process runner may RE-FIRE
`watch_patterns` on buffered output from the ALREADY-DEAD old process IDs (e.g. a
stale "[old PID] listening on" / "Application startup complete"). Treat any delayed
banner from a previously-killed process ID as SUSPECT. Verify with `ps` (real PIDs)
+ a live `curl` probe, and grep the served HTML/JS for the expected label/version.
Do NOT act on the phantom banner.

## Correct restart sequence (kill → launch → verify, in separate calls)
1. Kill stale by PID / bracket pattern (separate terminal call).
2. Launch fresh in a background-process runner (NOT chained with the kill):
   e.g. `cd ~/lailaba-ai && exec venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info`
3. Verify in a THIRD call: `curl` for 200 + `ps` for the new PID + grep served
   content for the expected build label (e.g. `app.js?v=14`, "Challenge 1").

## GOTCHA: bracket trick STILL self-matches if the target binary appears LITERALLY elsewhere in the SAME command
The bracket trick only prevents the `pkill` PATTERN from matching its own
`pkill -f "[u]vicorn app.main:app"` syntax. It does NOT protect against OTHER literal
occurrences of the target string in the same shell command line. This BIT the session:

    pkill -9 -f "[u]vicorn app.main:app"; sleep 1; \
      tmux new-session ... "uvicorn app.main:app --host 0.0.0.0 --port 8000 ..."

The `tmux new-session` launch string contains the literal `uvicorn app.main:app`, so the
regex `[u]vicorn app.main:app` matches the running bash's OWN cmdline → the shell is killed
(returns `exit_code: -9`) and the launch never runs. The bracket trick gave false confidence.

SAFE alternatives (pick one):
- Put the kill in its OWN terminal call, SEPARATE from any launch command that names the binary.
- Kill by exact PID (the `grep` uses the bracket trick so it won't match itself; `kill` names no target):
  `PID=$(ps -eo pid,args | grep "[u]vicorn app.main:app" | awk '{print $1}'); kill -9 $PID`
- Or `tmux kill-session -t <name>` first, then launch in a FRESH call with NO pkill at all.
