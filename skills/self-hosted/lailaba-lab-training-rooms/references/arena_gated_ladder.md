# Arena (Guardian) gated ladder — frontend gating recipe (session 5, 2026-07-12)

The user wanted the Arena Guardian to (a) NOT lock even Level 1, and (b) have
**at least 12 levels** with rising difficulty + one-by-one unlock (like the Live
Range). The Arena already had backend levels in `app/api/routes/lab.py`
(ARENA_LEVELS) with rising defenses, and the backend auto-advances on breach —
but the level rail let you CLICK ANY LEVEL, and the backend had only 6 entries
(so levels 7–12 returned `400 Invalid level` and were ungradeable). This recipe
covers the full 12-level expansion + the lock fix + the cache-buster.

## Files that carry the Arena UI (NOT dead ones)
- `lab/js/app.js`      — LEVELS[], loadLab(), renderLevelRail(), selectLevel(), sendArena()
- `lab/css/lab.css`    — `.lab-level-pill` styles + `.lv-diff` bands
- `lab/index.html`     — `#level-rail`, `#arena-card`, `#arena-chat`, script tag
- `app/api/routes/lab.py` — ARENA_LEVELS (server-authoritative secrets; now 12)
- DEAD/UNROUTED (never edit): `app/static/js/lab.js`, `app/templates/lab.html`

## CRITICAL: frontend level count MUST match backend ARENA_LEVELS length
`app/api/routes/lab.py` `arena_attack()` does:
```python
if data.level < 1 or data.level > len(ARENA_LEVELS):
    raise HTTPException(status_code=400, detail="Invalid level")
level = ARENA_LEVELS[data.level - 1]
```
So if the frontend sends `level: 12` but `ARENA_LEVELS` only has 6 → `400 Invalid
level`, the level is ungradeable. **Always add matching backend entries in
ARENA_LEVELS (id `arena-N`, `level` N, `title`, `secret`, `defending_prompt`,
`hints[]`) whenever you add frontend LEVELS[].** The backend is the source of
truth for grading; the frontend LEVELS[] just drives the rail/UI/avatar/diff.
Secrets are stripped from the public `/api/lab/challenges` payload, so keep
frontend `objective` text consistent with the backend `secret` but never leak it.

## Step 1 — expand LEVELS[] to 12 with `diff` bands (app.js)
12 levels, SLOW(1-3) / MEDIUM(4-7) / HARD(8-12). Each entry:
`{ id, level, name, avatar, diff, objective }`. The `diff` band drives the pill
color + the "Level N · BAND" header. Keep `id` = `arena-N` and `level` = N so
`isUnlocked` / progress keys line up. (Full list lives in `app.js`; the band
split is 3 slow / 4 medium / 5 hard — re-band if the user wants a per-level
gradient.)

## Step 2 — gating helper + lock the rail (app.js)  [unchanged from before]
```js
function isUnlocked(i) {
  if (i <= 0) return true;                       // L1 ALWAYS unlocked
  const prev = LEVELS[i - 1];
  return !!PROGRESS['arena/' + prev.id]?.solved; // prior solved → unlocked
}
// renderLevelRail(): pill.className += unlocked ? '' : ' locked'; pill.disabled = !unlocked;
```

## Step 3 — FIX for "even Level 1 locked" (stale JS cache + resilient load)
Symptom reported: every level — including L1 — showed locked. The gating code in
source was already correct (`isUnlocked(0)` returns true), so the cause was a
**STALE CACHED app.js in the browser** from an earlier buggy intermediate state.
Two fixes applied:
1. **Resilient `loadLab()`** — initialize `PROGRESS = {}` BEFORE any fetch, and
   fetch `/api/lab/challenges` and `/api/lab/progress` in SEPARATE try/catch
   blocks. If the progress call fails (auth/network), `renderLevelRail()` +
   `selectLevel(0)` STILL run with an empty PROGRESS → L1 stays unlocked.
   (Old code used `Promise.all` + one catch; if ANY fetch threw, render never ran
   and the user could see a half-rendered/locked rail.)
   ```js
   async function loadLab() {
     PROGRESS = {};                               // default → L1 always playable
     try { const r = await apiFetch('/api/lab/challenges'); CATALOG = (await r.json()).modules; }
     catch (e) { showToast('Failed to load challenges: ' + e.message, 'error'); }
     try { const r = await apiFetch('/api/lab/progress');
           const pdata = (await r.json()).progress || [];
           pdata.forEach(p => { PROGRESS[p.module + '/' + p.challenge_id] = p; }); }
     catch (e) { /* non-fatal: L1 stays unlocked */ }
     renderLevelRail(); updateArenaProgress(); selectLevel(0);
   }
   ```
2. **Cache-buster** in `lab/index.html` so the browser drops the stale copy:
   `<script src="/lab/js/app.js?v=12"></script>` (bump `?v=` whenever you change
   app.js). After ANY arena JS change, tell the user to **hard-refresh**
   (Ctrl/Cmd+Shift+R) — a plain reload may keep the broken cached version.

## Step 4 — band styles (lab.css, inside the LEVEL RAIL block) — unchanged
```css
.lab-level-pill.locked { opacity: .45; cursor: not-allowed; filter: grayscale(.5); }
.lab-level-pill .lv-diff { font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; border:1px solid transparent; }
.lab-level-pill .lv-diff.slow   { color: var(--accent); border-color: var(--accent); background: rgba(16,163,127,.12); }
.lab-level-pill .lv-diff.medium { color: var(--gold);   border-color: var(--gold);  background: rgba(255,210,74,.12); }
.lab-level-pill .lv-diff.hard   { color: var(--danger); border-color: var(--danger);background: rgba(224,82,75,.12); }
```

## Verify on device (served files — browser-equivalent)
```bash
node --check lab/js/app.js && echo "app.js OK"
curl -s http://127.0.0.1:8000/lab/js/app.js | grep -cE "id: 'arena-"      # expect 12
curl -s http://127.0.0.1:8000/lab/js/app.js | grep -oE "arena-12|The Citadel"
curl -s http://127.0.0.1:8000/lab/index.html | grep -oE "app.js\?v=12|0 / 12 breached"
curl -s http://127.0.0.1:8000/api/lab/challenges | python3 -c "
import sys,json
a=[x for x in json.load(sys.stdin)['modules'] if x['key']=='arena'][0]
print('levels:', len(a['items']))                        # expect 12
[print(' ', i['id'], i['title']) for i in a['items']]
"   # secrets NOT in the public payload
# Level 12 gradeable (logged-in): must NOT 400. Unauth → 401 (expected, not 400).
curl -s -o /dev/null -w "lvl12 unauth -> %{http_code} (401 ok, NOT 400)\n" -X POST \
  http://127.0.0.1:8000/api/lab/arena -H "Content-Type: application/json" \
  -d '{"level":12,"prompt":"x"}'
```

## Cross-feature rule (user preference)
"do it also for arena" / "make both the same" ⇒ any progression/UI pattern applied
to ONE Lab sub-feature (Arena Guardian vs Live Range) must be mirrored on the
OTHER. Keep them visually + behaviorally consistent: SLOW/MEDIUM/HARD bands,
one-by-one unlock, progress feedback.
