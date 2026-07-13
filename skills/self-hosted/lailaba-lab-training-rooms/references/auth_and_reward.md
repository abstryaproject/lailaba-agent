# Live Range auth + auto 100-credit reward (session 8, 2026-07-12)

## Why this exists
The early Lab trusted the Live Range iframe's `localStorage` for "all 12 solved", which both
unlocked Challenge 2 and (if a reward existed) the reward on pure client tampering. The user
required: "ensure lab to use user authentication" and "if user excellently passed all 24 level on
2 challenges will be credited with 100 credit chat automatically on his lailaba ai account". Fix =
move progress server-side, verify flags authoritatively, and credit once.

## Backend pieces (app/api/routes/lab.py)
- `LabReward` table (app/core/database.py): `user_id` UNIQUE, `credits_awarded`. Guards idempotency.
- `POST /api/lab/range/submit` (auth required): body `{level:int, flag:str}`. Backend POSTs
  `{level, flag}` to the sandbox `POST /api/verify` (httpx). `/api/verify` checks
  `FLAG_BY_LEVEL[str(level)] == flag` EXACTLY (sandbox holds the secret; client never does).
  On correct: writes `LabProgress(module='live_range', challenge_id=str(level), solved=True)`.
  THEN calls `_award_completion_reward()`.
- `GET /api/lab/range/progress` and `GET /api/lab/completion`: return
  `arena_solved` / `range_solved` / `complete` / `rewarded` / `credits_awarded` / `credits_remaining`.
- `_award_completion_reward(db, user, request)`: if `LabReward` row exists -> `None` (no double
  credit). Else if `arena_solved >= 12 AND range_solved >= 12`: `user.paid_chats_remaining += 100`,
  add `LabReward(credits_awarded=100)`, log `lab_completion_reward`. Returns the award dict.

## Sandbox pieces (lab/runtime/labserve.py)
- `FLAG_BY_LEVEL = {str(n): f for n,f in FLAGS.items()}` — server-authoritative flag map.
- `POST /api/verify`: parse JSON `{level, flag}`; respond `{"ok": bool, "level": int, "expected_len": int}`.
  `ok = (expected is not None) and (sub == expected)`. Never returns the flag.

## Frontend pieces
- Iframe (`labserve.py` FRONTEND_HTML): on solve, `extractFlag(t)` pulls `LAB{...}` from the response,
  `notifySolved(n, flag)` `postMessage`s `{type:'lailaba_range_solved', level:n, flag}`.
- Parent (`lab/js/app.js`): `submitRangeSolve(level, hint)` -> `POST /api/lab/range/submit` with JWT
  (auth.js `apiFetch` already attaches `Authorization: Bearer <token>`). Then `refreshCompletion()`
  reads `GET /api/lab/completion` and sets `window.__labComplete`; `isChallenge2Unlocked()` returns
  `window.__labComplete === true || <local mirror>`. `loadLab()` calls `refreshCompletion()`.
- `index.html`: `#lab-credits` badge + `#chip-progress` ("0 / 24 solved"); locked placeholder explains
  the 24-level + 100-credit reward.

## END-TO-END VERIFY RECIPE (use venv python, NOT system python3 — no sqlalchemy there)
```bash
cd ~/lailaba-ai
B=http://127.0.0.1:8000
TS=$(date +%s); E="labtest_${TS}@example.com"; PW="Test1234!"
curl -s -X POST $B/api/auth/register -H 'Content-Type: application/json' \
  -d "{\"email\":\"$E\",\"full_name\":\"T\",\"password\":\"$PW\",\"confirm_password\":\"$PW\"}" >/dev/null
TOKEN=$(curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$E\",\"password\":\"$PW\"}" | venv/bin/python -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
A="Authorization: Bearer $TOKEN"
FLAGS=("LAB{idor_broken_access_control_user0_leaked}" "LAB{debug_endpoint_leaked_internal_config}" "LAB{open_redirect_to_internal_admin_panel}" "LAB{jwt_claims_expose_admin_scope_in_token}" "LAB{jwt_alg_none_forged_admin_claim}" "LAB{nosql_injection_auth_bypass_admin}" "LAB{ssrf_reached_cloud_metadata_service}" "LAB{command_injection_simulated_cat_flag}" "LAB{path_traversal_etc_passwd_read}" "LAB{ssrf_filter_bypass_via_ipv6_mapped}" "LAB{prototype_pollution_object_prototype_tainted}" "LAB{insecure_deserialization_rce_simulated}")
for i in $(seq 1 12); do curl -s -X POST $B/api/lab/range/submit -H "$A" -H 'Content-Type: application/json' -d "{\"level\":$i,\"flag\":\"${FLAGS[$((i-1))]}\"}" >/dev/null; done
curl -s -X POST $B/api/lab/range/submit -H "$A" -H 'Content-Type: application/json' -d '{"level":1,"flag":"FAKE"}'   # -> {"correct":false}
venv/bin/python - <<'PY'
import sys; sys.path.insert(0,'.')
from app.core.database import SessionLocal, LabProgress, User, LabReward
from app.api.routes.lab import _award_completion_reward
db=SessionLocal()
u=db.query(User).filter(User.email.like('labtest_%')).order_by(User.id.desc()).first()
for n in range(1,13):
    r=db.query(LabProgress).filter_by(user_id=u.id,module='arena',challenge_id=f'arena-{n}').first()
    if not r: r=LabProgress(user_id=u.id,module='arena',challenge_id=f'arena-{n}'); db.add(r)
    r.solved=True
db.commit()
class Req: client=None
print("award:", _award_completion_reward(db,u,Req()))   # -> {'credits_awarded':100,...}
print("second:", _award_completion_reward(db,u,Req()))   # -> None (idempotent)
PY
curl -s $B/api/lab/completion -H "$A"   # -> complete:true, rewarded:true, credits_awarded:100
```
Assertions: all 12 range `ok`; FAKE -> `correct:false`; completion `complete:true, rewarded:true,
credits_awarded:100`; second award `None`. A user with only Live Range solved (12/12) shows
`rewarded:false`.

## Pitfalls
- System `python3` lacks `sqlalchemy` (server venv only) -> use `venv/bin/python`.
- Register endpoint requires `confirm_password` (UserRegister schema).
- Don't claim arena is "live-passable" unless `OPENROUTER_API_KEY` is set; verify grading/reward
  deterministically via DB rows instead.
- The `patch` tool corrupts multi-line JS if `new_string` uses literal `\n`; repair via execute_code
  + `node --check`.
