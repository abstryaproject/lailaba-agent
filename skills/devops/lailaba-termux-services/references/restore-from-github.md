# Restore lailaba-ai to upstream GitHub (without losing local work)

When the user says "restore from github" / "restore original", they mean: discard local
changes and return the `~/lailaba-ai` app to the committed `origin/main` state. BUT local
uncommitted work may exist (e.g. custom lab modules, theme, arena) that must NOT be lost.

## Safe sequence (verified this session)
1. Inspect first — never blind `reset --hard`:
     cd ~/lailaba-ai && git status --short && git stash list
   Note any modified/untracked files (e.g. `lab/runtime/`, `app/templates/lab.html`).
2. Stash EVERYTHING (including untracked) so it is recoverable later:
     git stash push -u -m "pre-restore-$(date '+%Y%m%d-%H%M%S')"
   Verify: `git stash list` shows the new stash. Local work is now saved, not destroyed.
3. Fetch + reset to upstream:
     git fetch origin
     git reset --hard origin/main        # HEAD now = upstream; working tree clean
4. Relaunch the server (see termux-process-kill.md for kill→launch→verify):
   kill the old uvicorn PID, then in a FRESH tmux session (no pkill in the same line):
     cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
5. Verify: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health` → 200.

## Recovering the stashed local work later
   cd ~/lailaba-ai && git stash pop        # or `git stash apply stash@{0}` to keep the stash
   WARNING: `git stash pop` after a `reset --hard` can produce conflicts if upstream touched
   the same files. Resolve conflicts, or `git stash branch <name>` to inspect on a throwaway branch.

## Removing a feature/service (the inverse operation)
To fully remove a mounted service (demonstrated: removing the `/lab` training module):
- Backend: drop `app.include_router(<svc>.router)` AND any `app.mount("/<svc>", ...)` in
  app/main.py; delete `app/api/routes/<svc>.py`; remove the ORM model from app/core/database.py.
- Frontend: delete the template (`app/templates/<svc>.html`) and static assets
  (`app/static/js/<svc>.js`, `app/static/css/<svc>.css`); remove any sidebar links.
  To gate a REPLACEMENT link by role (e.g. show "Admin Dashboard" only to admins): set it
  `style="display:none"` by default in the template, then toggle in JS from the logged-in
  user's `role` field: `user?.role === 'admin' ? 'block' : 'none'`. Non-admins see no link.
- Always `python -c "import app.main"` after editing to catch broken imports, then relaunch
  + curl-verify. A removed static mount should return 404; the replacement route 200.
