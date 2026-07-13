# Removal procedure — full teardown of the Training Rooms feature

Used when the user says "remove it all" / "remove the training lab". Exact sequence that worked
on 2026-07-12 (Termux/armv7l, repo at `~/lailaba-ai`, baseline commit `4a4f715`).

## Steps
1. **Inspect scope first.** `cd ~/lailaba-ai && git status --short` and `git diff --stat` to see
   what we changed vs baseline. Confirm the working tree is clean at a known baseline so a
   `git checkout` is safe.
2. **Revert tracked files** we modified:
   `git checkout HEAD -- app/api/routes/lab.py app/main.py app/templates/chat.html app/templates/lab.html lab/css/lab.css lab/index.html lab/js/app.js`
3. **Delete untracked new files / dirs** we created:
   `rm -f app/api/routes/training_rooms.py lab/lab-runtime-frame.html scrub.txt`
   `rm -rf lab/runtime`
4. **Confirm gone:** `grep -n "training_rooms\|TRAINING_ROOMS" app/api/routes/lab.py` → none;
   `grep -n "lab-runtime\|_LAB_RUNTIME\|httpx" app/main.py` → none.
5. **Kill the runtime session — do NOT `tmux send-keys C-c`** (that kills the whole session).
   `tmux kill-session -t lailaba-lab` (safe; separate session). Verify `:8080` free:
   `curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:8080/` → `000`.
6. **Strip the boot block** from `~/.local/bin/service-manager.sh` (the `lailaba-lab` start
   section between the `lailaba-server` block and the `hermes-dashboard` block).
7. **Restart the FastAPI server** (Python changes need it). Recreate the session, do NOT C-c:
   `tmux new-session -d -s lailaba-server -x 200 -y 50` then
   `tmux send-keys -t lailaba-server "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info" Enter`
   Wait ~5s; `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/` → `200`.
8. **Verify removal on the served site** (see `verify_on_device.md`):
   - `curl -s http://127.0.0.1:8000/api/lab/training/rooms` → `404` (route gone)
   - `curl -s http://127.0.0.1:8000/lab-runtime/ctfd/api/v1/scoreboard` → `404` (proxy gone)
   - `curl -s http://127.0.0.1:8000/lab/ | grep -oE 'Training Modules|training-modal|room-rail|🎯'` → none
   - `curl -s http://127.0.0.1:8000/lab/js/app.js | grep -oE "renderTrainingList|openRoom|live-panel|lab-runtime-frame"` → none
   - Arena still up: `/lab/` 200, `/api/lab/challenges` 200, served HTML still has `level-rail`,
     `arena-card`, `arena-chat`.

## Notes
- The original packaged Lailaba ("Training Modules" drawer from baseline `4a4f715`) is ALSO a
  training feature. "Remove it all" includes it — strip the drawer/modal from `lab/index.html`
  and the `renderTrainingList`/`openTraining`/`build*`/`submitFlag` JS from `app.js`, keeping
  `escapeHtml` (the Arena uses it). Verify with the grep chain above.
- When rewriting `app.js` wholesale, watch for `write_file` double-escaping `\"` inside regex
  char classes (`/["']/` → `/[\\"]/`). Run `node --check` after; fix by rewriting the one line.
