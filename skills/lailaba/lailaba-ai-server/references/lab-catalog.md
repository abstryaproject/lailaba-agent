# Lab training catalog — data model & editing (room-based)

## Two surfaces
1. **Arena** — prompt-injection gamified levels. Data: `ARENA_LEVELS` in
   `app/api/routes/lab.py` (`level`, `persona`, `secret`, `defending_prompt`, `hints`).
   Grading via `POST /api/lab/arena`.
2. **Training Lab** — 14 rooms, one real platform per room, each with graded tasks.
   This is the main user-facing training surface.

## Source of truth for rooms
`~/lailaba-ai/app/api/routes/training_rooms.py` → `TRAINING_ROOMS` (a **list**, not a dict).
Each room:
```python
{
  "id": "room-1",            # "room-N"
  "room": 1,                 # numeric room number
  "title": "CTFd",
  "icon": "🚩",
  "category": "CTF Platform",
  "summary": "...",          # shown at top of room view
  "url": "https://github.com/CTFd/CTFd",   # repo link-out
  "deploy": "docker run -p 8000:8000 ctfd/ctfd",  # snippet for an x64 server
  "requirements": "...",     # e.g. "Docker, 2GB RAM"
  "compatible": "server",    # server | this-device | vm-only  (HONEST flag)
  "tags": ["CTF", "Scoreboard"],
  "tasks": [
    {"id": "t1", "title": "...", "question": "...", "hint": "...", "expected": ["points", "total points"]}
  ],
}
```
`compatible` is the runnability flag the UI renders as a colored chip
(`.comp-server` amber / `.comp-device` green / `.comp-vm` red). **Never set `this-device`
for an app that cannot actually run on this armv7l/450MB Termux host** — the user explicitly
wants honest flags, not a fake "runs here" badge.

## Routes (in `app/api/routes/lab.py`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/lab/challenges` | no | `modules`: `arena` + `training` + link-out modules. |
| GET | `/api/lab/training/rooms` | no | list of rooms, `tasks`/`expected` STRIPPED. |
| GET | `/api/lab/room/{room_id}` | **yes** | full room incl. `expected` (UI grades client-side). |
| POST | `/api/lab/training/submit` | yes | body `{module, challenge_id, answer}`; persists progress. |
| GET | `/api/lab/progress` | yes | `{progress:[{module,challenge_id,solved,attempts}]}`. |
| GET/POST | `/api/lab/arena`, `/api/lab/submit` | mixed | arena + legacy submit. |

Room `id` values are `room-1` … `room-14` (NOT `ctfd` etc. — a common wrong guess when
probing). The 14th is `CyberRange` (vm-only).

## Frontend files (edit these, NOT the dead copies)
- `lab/index.html` — tab header (🛡️ Arena / 🎯 Training Lab), `.lab-tab-pane` panes.
- `lab/js/app.js` — `setupTabs()`, `renderRoomRail()`, `renderRoom()`, `gradeTask()`
  (client-side check of `submitted` against `task.expected`), `persistTraining()`.
  Helpers `isAuthenticated/getUser/apiFetch/showToast/initTheme` come from `/static/js/auth.js`.
- `lab/css/lab.css` — `.lab-tabs`, `.lab-tab-pane`, `.lab-rooms`, `.lab-room-pill`, `.room-note`.
- DEAD copies (never edit): `app/static/js/lab.js`, `app/templates/lab.html`.

## Edit + verify checklist
1. Edit `training_rooms.py` (content) and/or `lab.py` (routes) and/or the `lab/*` frontend.
2. If backend changed: **restart uvicorn** in tmux `lailaba-server` (Ctrl-C, re-send);
   uvicorn has no `--reload`.
3. If `app.js` rewritten via `write_file`: `node --check lab/js/app.js`.
4. Verify:
   - `curl -s localhost:8000/api/lab/training/rooms | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['rooms']),[r['id'] for r in d['rooms']])"` → expect `14` rooms, ids `room-1..room-14`.
   - removed modules gone: `...['modules']` should contain only `arena`, `training`, and any
     link-out modules — NOT "Linux & Terminal Lab", "Programming Playground",
     "Ethical Hacking Basics", "Cybersecurity / CTF".
   - authed room detail (mint JWT, see SKILL.md "Verifying backend/frontend edits"):
     `GET /api/lab/room/room-1` → `room.tasks` present with `expected`.
   - live submit: `POST /api/lab/training/submit` with a correct answer → `{"correct":true,"solved":true}`, then confirm via `GET /api/lab/progress`. Clean up the test row afterward.

## Verified platform URLs (studied this session)
CTFd github.com/CTFd/CTFd · RootTheBox github.com/moloch--/RootTheBox (fork; rootthebox/rootthebox 404s)
· FBCTF github.com/facebookarchive/fbctf · Mellivora github.com/Nakiami/mellivora
· Vulhub github.com/vulhub/vulhub · OWASP Juice Shop github.com/juice-shop/juice-shop
· Metasploitable sourceforge.net/projects/metasploitable/ · DVWA github.com/digininja/DVWA
· OWASP WebGoat github.com/WebGoat/WebGoat · Security Shepherd github.com/OWASP/SecurityShepherd
· DetectionLab github.com/clong/DetectionLab · PurpleSharp github.com/mvelazco/PurpleSharp
· Caldera github.com/mitre/caldera · CyberRange cyberdefenders.org
