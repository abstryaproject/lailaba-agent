# Restore the Lab from the removal git stash (surgical — `git stash pop` aborts)

## Why surgical
`git stash pop` fails here: the working tree has uncommitted theming/admin/PWA edits that
conflict with the stash's lab wiring. Restore only the lab files, then re-apply the 3 core
re-wires by hand onto the CURRENT tree.

## Step 1 — restore standalone lab files (deleted, not modified → no conflict)
```bash
cd ~/lailaba-ai
git checkout stash@{0} -- lab/ app/api/routes/lab.py app/static/css/lab.css \
  app/static/js/lab.js app/templates/lab.html app/services/ai_service.py
```

## Step 2 — re-wire cores (paste EXACT blocks; do not retype identifiers)

### app/core/database.py — insert before `# Indexes for performance`
```python
class LabProgress(Base):
    __tablename__ = "lab_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    module = Column(String(40), nullable=False)       # arena, terminal, code, ethhack, ctf
    challenge_id = Column(String(60), nullable=False)  # unique within module
    solved = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    best = Column(Integer, default=0)                 # best score / seconds where relevant
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_lab_user_module", "user_id", "module"),
        Index("idx_lab_user_challenge", "user_id", "module", "challenge_id", unique=True),
    )


class LabReward(Base):
    __tablename__ = "lab_rewards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    credits_awarded = Column(Integer, default=0)
    awarded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

### app/core/config.py — inside `class Settings`, before the Paystack block
```python
    # Lab / Arena: by DEFAULT the Arena uses the built-in deterministic training
    # simulator so every prompt-injection level is ALWAYS completable on-page.
    # Set LAB_ARENA_REALTIME=true to route the Arena through the live model.
    LAB_ARENA_REALTIME: bool = False
```

### app/main.py — 4 edits
```python
# (a) import line (was: from app.api.routes import auth, chat, payment, admin)
from app.api.routes import auth, chat, payment, admin, lab

# (b) after the other app.include_router(...) calls
app.include_router(lab.router)

# (c) after `if STATIC_DIR.exists(): app.mount("/static", ...)`
# Lab package: serve the /lab directory as static (index.html + css/js)
LAB_DIR = BASE_DIR / "lab"
if LAB_DIR.exists():
    app.mount("/lab", StaticFiles(directory=str(LAB_DIR), html=True), name="lab")

# (d) rate limiter — replace `if request.url.path.startswith("/static"):`
    _p = request.url.path
    if (_p.startswith("/static") or _p.startswith("/lab") or _p.startswith("/api/lab")
            or _p in ("/sw.js", "/manifest.json", "/health")):
```

## Step 3 — restart server (kill + relaunch separately; pkill self-matches the shell)
```bash
pkill -9 -f "app.main:app"          # its own short call
tmux kill-session -t lailaba-server 2>/dev/null
tmux new-session -d -s lailaba-server -x 200 -y 50
tmux send-keys -t lailaba-server "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info" Enter
```

## Step 4 — start Live Range
```bash
tmux new-session -d -s lailaba-lab -x 120 -y 30 "python3 /data/data/com.termux/files/home/lailaba-ai/lab/runtime/labserve.py"
```

## Step 5 — verify (real output, not assumed)
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health          # 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/lab/            # 200
curl -s http://127.0.0.1:8000/lab/ | grep -oE 'id="(challenge-1|challenge-2|level-rail)"'
curl -s http://127.0.0.1:8000/lab/ | grep -oE 'training-panel' || echo "no catalog artifacts"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/health     # 200
curl -s "http://127.0.0.1:8000/api/lab/runtime/api/orders?user=0"             # -> FLAG{idor_...}
# browser-burst 429 test (python threads, loopback) -> 429 count = 0
```
