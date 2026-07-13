---
name: lailaba-lab-training-rooms
description: "Lifecycle of the in-app Lab training-rooms feature of the self-hosted Lailaba AI server (~/lailaba-ai): how to BUILD a live, exploitable, on-device vulnerable-lab (real flags, not quizzes), how to VERIFY it on the actual device before declaring done, and how to REMOVE it completely. CURRENT (2026-07-12, session 10): 24-level game; LIVE RANGE (C1) 12 levels always visible on-device sandbox, ARENA Break the Guardian (C2) 12 levels hidden until all 12 Live Range breached; Live Range re-banded MEDIUM 1-3 / HARD 4-8 / ELITE 9-12 (strictly harder than Arena SLOW/MEDIUM/HARD); progress AUTH-GATED + SERVER-SIDE; Arena deterministic simulator (no live LLM needed); 24/24 auto-credits 100 idempotent chat credits; rate-limiter exempts /lab + /api/lab."
---

# Lailaba Lab — Training Rooms (lifecycle skill)

The "Lab" is a feature of the **separate** Lailaba AI server at `~/lailaba-ai` (FastAPI +
uvicorn, `0.0.0.0:8000`, OpenRouter). It is NOT the native `lailaba proxy`.

## CURRENT STATE (2026-07-12, session 10) — 24-level game: **LIVE RANGE (C1) is the always-visible opening** (on-device sandbox at /api/lab/runtime/, `<section id="challenge-1">` no `hidden`), and **ARENA "Break the Guardian" (C2) is hidden** (`<section id="challenge-2" hidden>` + `#challenge-2-locked` 🔒 placeholder) until all 12 Live Range levels are solved (verified session 10). Live Range RE-BANDED so C2/C1 difficulty reads MEDIUM 1-3 → HARD 4-8 → ELITE 9-12 (Arena uses SLOW 1-3 → MEDIUM 4-7 → HARD 8-12, so the Live Range is strictly harder-banded); Live Range progress AUTH-GATED server-side; Arena deterministic simulator (no live LLM needed); 24/24 auto-credits 100 idempotent chat credits; rate-limiter exempts /lab + /api/lab.
A prior cleanup deleted the ENTIRE Lab (quiz drawer + 14-room catalog + live sandbox + proxy) under
one "remove it all". But the live sandbox was the user's desired **"demo working environment"**
(standing directive: "provide a demo working environment, not only questions, because it is lab not a
class"). With the sandbox gone, `/lab` was arena-only — which contradicted that directive. So the
**Live Range** (synthetic on-device vulnerable server) was REBUILT. On disk right now:
- `/lab` serves the **Arena** (Guardian prompt-injection game) as **Challenge 1** (always visible,
  `id="challenge-1"`) PLUS a **"Live Range"** card as **Challenge 2** (hidden `id="challenge-2"`,
  revealed only after all 12 Arena levels are breached; `id="challenge-2-locked"` 🔒 placeholder).
  Files: `lab/index.html` (chips + two challenge sections), `lab/js/app.js` (Arena-first gating +
  status pill), `lab/css/lab.css` (`.lab-range` styles; dead `.lab-training`/`.t-*`
  classes pruned).
- `lab/runtime/labserve.py` — REBUILT (stdlib-only, `127.0.0.1:8080`, tmux `lailaba-lab`). 3 synthetic
  scenarios: IDOR (`/api/orders?user=0`), JWT `alg=none` forgery (`/api/token` → forge → `/api/admin`),
  simulated command injection (`/api/ping?host=...;cat+/flag`). Each returns a `FLAG{...}`.
  As of 2026-07-12 (session 3) the range is now a **GATED LADDER** of 3 difficulty levels —
  SLOW (IDOR, trivial param flip) → MEDIUM (JWT alg=none forge) → HARD (simulated CMDi behind a
  WAF that blocks the literal word "flag", requiring glob/obfuscation like `;cat+/fl*`). Levels 2/3
  are LOCKED until the prior flag is captured; progress is saved in the browser (localStorage) and a
  progress bar fills SLOW→MEDIUM→HARD. Same gating feel as the Guardian arena's level-rail.
- `lab/runtime/labserve.py` — REBUILT + EXPANDED to a **GATED 12-LEVEL LADDER** (session 6;
  was 3 levels). Levels MEDIUM 1-3 → HARD 4-8 → ELITE 9-12 (re-banded so Challenge 2 / Live
  Range is strictly harder than Challenge 1 / Arena, which tops out at HARD; ELITE is a new
  purple band), each a distinct synthetic vuln with
  a real flag: L1 IDOR (`/api/orders?user=0`), L2 verbose debug leak (`/api/debug`), L3 open
  redirect (`/api/redirect?next=/admin`), L4 secrets-in-token (`/api/token` claims carry the
  flag), L5 JWT `alg=none` forgery (`/api/token` → forge → `/api/admin`), L6 NoSQL auth bypass
  (`/api/login` with `{"pw":{"$gt":""}}`), L7 SSRF → cloud metadata (`/api/fetch?url=http://
  169.254.169.254/`), L8 CMDi+WAF (`/api/ping?host=...;cat+/fl*&waf=1`), L9 path traversal
  (`/api/file?name=....//....//etc/passwd`), L10 SSRF filter bypass via IPv6-mapped localhost
  (`http://[::ffff:127.0.0.1]/`), L11 prototype pollution (`/api/config` `__proto__`), L12
  insecure deserialization (`/api/unpickle` pickle opcodes). Gating is client-side in the
  served HTML: level n unlocked only if `n===1 || solved(n-1)`, solved levels in
  `localStorage['lailaba_range_v12']`. The frontend posts `lailaba_range_done` to the parent and
  the parent (app.js) reveals **Challenge 2** (Arena) — see rule #9 + `references/challenge_gating.md`.
  - Proxy: `app/api/routes/lab.py` mounts `/runtime/{path:path}` → full path **`/api/lab/runtime/*`**
  (NOT `/lab-runtime/*` — the api router already carries `/api/lab`) → `http://127.0.0.1:8080/{path}`
  via `httpx.AsyncClient`. Whitelists `/api/health`, `/api/token`, `/api/orders`, `/api/admin`,
  `/api/ping`, `/`; blocks `..` / `//` traversal.
- `service-manager.sh` has a `lailaba-lab` auto-start block (guards on `tmux has-session`).
- The 14-room **catalog** (`app/api/routes/training_rooms.py`, room rail, quiz `tasks[]`) is STILL
  removed — only the synthetic sandbox was rebuilt. Don't assume those catalog files exist.
- **Arena (Guardian) is now 12 gated levels** (was 6). Backend `ARENA_LEVELS` in
  `app/api/routes/lab.py` has 12 entries (SLOW 1-3, MEDIUM 4-7, HARD 8-12; final boss
  `arena-12` "The Citadel", secret `MASTER-OF-INJECTION`). Frontend `LEVELS[]` in
  `lab/js/app.js` matches (12 entries, `diff` bands). Progress is server-side (LabProgress).
  The 6→12 expansion surfaced a key bug: the backend `arena_attack()` rejects
  `level > len(ARENA_LEVELS)` with `400 Invalid level`, so **frontend level count must
  always match the backend list length** (see rule #5b + `references/arena_gated_ladder.md`).
  "Level 1 locked" was a STALE-BROWSER-CACHE symptom, fixed by a resilient `loadLab()`
  (PROGRESS={} default, separate try/catch) + a `?v=12` cache-buster on the script tag.
If the user asks to expand the range or restore the catalog, follow BUILD below.

## USER HARD RULES (embed — these caused rework when violated)
1. **It's a lab, not a class.** A training room must be a *working exploitable environment* you
   attack for real and capture a `FLAG{...}` from — NOT quiz questions. Rooms that genuinely
   need an x64 VM / Docker / Java / PHP stay honest **"reference only"** cards (deploy command +
   "needs VM/x64"). NEVER fake a "running" badge; the user prefers being told the hardware can't.
2. **Arena, not a tab.** Training rooms live INSIDE the Arena view (a right-hand panel / room
   rail), not as a separate top-level tab. The user explicitly said "ensure it to arena not in tab."
3. **ALWAYS VERIFY ON THE ACTUAL DEVICE BEFORE DECLARING DONE.** The user said "verify it
   because it not work for my site. alway verify before done." Server-side proxy `curl` tests
   PASS while the actual browser breaks — see the pitfall below. Verify the *served* files and the
   real asset paths, not just source. Checklist in `references/verify_on_device.md`.
4. **Honor armv7l limits honestly.** Prebuilt x86_64 releases (e.g. OWASP Juice Shop
   `juice-shop-*_linux_x64.tgz`) do NOT run on this armv7l / ~450 MB device — no Docker, they
   OOM / build-fail. Don't propose them; build a stdlib-only twin instead (see BUILD).
5. **Training difficulty must RISE BY LEVEL and unlock ONE-BY-ONE.** When the user says "make it
   a ladder / leveled / not hard / increase by level / like the game", do NOT ship N independent
   equal boxes. Build a gated sequence: SLOW → MEDIUM → HARD, where each level is locked until the
   previous flag is captured (match the Guardian arena's level-rail feel). Low levels = trivial param
   change; mid = forge/token logic; high = a filter/WAF to defeat with obfuscation. See BUILD step 2
   and `references/live_range_rebuild.md` for the gated-ladder recipe.
6. **"Do it also for arena" = mirror the pattern across BOTH Lab sub-features.** When the user
   applies a progression/UI pattern to one half (Live Range OR Arena Guardian), they expect it on
   the OTHER too — keep them visually + behaviorally consistent (SLOW/MEDIUM/HARD bands, one-by-one
   unlock, progress feedback). The Arena gating recipe is in `references/arena_gated_ladder.md`.
7. **Frontend level count MUST match the backend `ARENA_LEVELS` length (or levels 404/400).**
   `app/api/routes/lab.py` `arena_attack()` rejects `level > len(ARENA_LEVELS)` with `400 Invalid
   level`. When you add Arena levels to the frontend `LEVELS[]` in `lab/js/app.js`, add the SAME
   number of matching entries to backend `ARENA_LEVELS` (id `arena-N`, `level` N, `title`, `secret`,
   `defending_prompt`, `hints[]`). The backend grades; the frontend only drives the rail. Secrets
   are stripped from the public `/api/lab/challenges` payload. (User pushed "at least 12 levels" →
   we went 6→12; the missing backend entries were silently ungradeable until matched.)
8. **Stale-JS-cache lock symptom + fix.** If the user reports "even the first level is locked" but
   the source gating is correct (`isUnlocked(0)` returns true), it's a STALE browser-cached `app.js`
   from an earlier buggy state. Fix: (a) make `loadLab()` resilient — set `PROGRESS={}` before any
   fetch and fetch challenges/progress in separate try/catch so a failed progress call never blocks
   `selectLevel(0)`; (b) bump a `?v=N` cache-buster on the `<script src="/lab/js/app.js?v=N">` tag;
   (c) tell the user to HARD-REFRESH (Ctrl/Cmd+Shift+R). A plain reload may keep the broken copy.
9. **CHALLENGE GATING — nested one-by-one across sub-features.** The user wants a GAME: Challenge 1
   fully done BEFORE Challenge 2 is even visible. **CURRENT VERIFIED ORDER (session 10, 2026-07-12):**
   **LIVE RANGE = Challenge 1** (always visible, `id="challenge-1"`, the on-device sandbox iframe) and
   **ARENA "Break the Guardian" = Challenge 2** (`id="challenge-2" hidden` + 🔒 placeholder, unlocked only
   after all 12 Live Range levels are solved). This is the user's original spec ("demo working environment
   not only questions"; Live Range is the hands-on C1, Arena is the bonus C2). It was briefly flipped to
   Arena=C1 in session 9, then REVERTED to Live-Range-first in session 10 after re-reading the spec and
   verifying end-to-end. If the page shows Arena first / Live Range hidden, that is the INVERTED (wrong)
   state — fix it by swapping back to Live-Range-first. To set the correct order: (a) in `lab/index.html`,
   `chip-1` → "Live Range", `chip-2` → "Break the Guardian"; the LIVE RANGE `<section id="challenge-1">`
   has NO `hidden` attr; the ARENA `<section id="challenge-2" hidden>` carries `hidden` + the
   `#challenge-2-locked` 🔒 placeholder (text: "Complete all 12 Live Range levels to unlock…"). (b) In
   `lab/js/app.js` the gating keys off LIVE RANGE completion: `isChallenge2Unlocked()` returns
   `window.__labRangeComplete === true || rangeSolvedCount() >= RANGE_TOTAL`; `refreshCompletion()` sets
   `window.__labRangeComplete = c.range_solved >= RANGE_TOTAL`; chip-1 `.ch-sub` shows `n / RANGE_TOTAL
   solved`; locked placeholder tracks `locked-range-count`. (c) Bump the `app.js?v=N` cache-buster and
   hard-refresh. The unlock predicate stays server-authoritative via `GET /api/lab/completion`.
   Mechanism (same-origin iframe only): the sandbox writes solved levels to `localStorage['lailaba_range_v12']`
   (the iframe's KEY is hardcoded `'lailaba_range_v12'` — NOT the RANGE_VERSION label, so it matches the
   parent's `RANGE_STORAGE`) and `postMessage({type:'lailaba_range_done', version:'v<N>'})` to the parent;
   the parent listens for that message AND calls `submitRangeSolve()` → `refreshCompletion()` → sets
   `window.__labRangeComplete`, then unhides C2. CRITICAL: `hidden` attr is overridden by `display:flex/grid`
   CSS — `challenge-2` carries `hidden` and the parent toggles `.hidden=true/false`; ensure no CSS forces
   `#challenge-2{display:...}` unconditionally. Keep the sandbox proxied same-origin (`/api/lab/runtime/*`);
   a different origin breaks shared localStorage + `window.parent`. `RANGE_TOTAL`/`ARENA_TOTAL` must equal
   the real level count (12) or C2 never unlocks. Verify the predicate with a node sim (LOCKED at 0/11
   solved, UNLOCKED at 12/12 — see `references/verify_gating_headless.js`). Full recipe in
   `references/challenge_gating.md` and `references/swap_challenge_order.md`.
 10. **ONE-AT-A-TIME strictly (vs gated ladder).** When the user says "show level
 one-by-one LIKE IN GAME MODE" / "level to be one by one", they want STRICT single-level
 reveal — NOT the gated ladder (which renders all N cards and greys out locked ones; the
 user still SEES the whole ladder). Strict mode renders ONLY `currentLevel()` (first
 unsolved), and the next card literally does NOT exist in the DOM until the current flag is
 captured. Implement in the iframe frontend: `currentLevel()` scans 1..TOTAL for the first
 unsolved (so it RESUMES on reload), `render()` builds a single card, `mark()` appends a
 "Next →" button calling `nextLevel()` which re-runs `render()`. The iframe still writes the
 FULL solved array to `localStorage['lailaba_range_v12']` (parent needs all 12 to unlock
 Challenge 2) — one-at-a-time only changes what is *displayed*, not what is *stored*.
 Verify: fresh load greps `LEVEL 1 / 12` + `id="i1"` but NO `id="i2"` in the served
 HTML. Full recipe in `references/one_at_a_time_mode.md`. Applies to BOTH Challenge 1
 Applies to BOTH Challenge 1 (Live Range) and, by rule #6, to Challenge 2 (Arena) if the user later asks for it there.
 11. **Lab must use authentication + SERVER-SIDE progress (no localStorage trust).** As of session 8 the
 Live Range iframe no longer owns progress via `localStorage` alone — that let anyone spoof "all 12
 solved" to unlock Challenge 2 or the reward. Instead: the iframe extracts the REAL flag from the
 response (`LAB\{[^}]*\}` regex) and `postMessage`s `lailaba_range_solved` with it; the parent
 (`lab/js/app.js` `submitRangeSolve`) calls `POST /api/lab/range/submit` with the JWT. The backend
 (`app/api/routes/lab.py`) re-verifies the flag against the sandbox's `POST /api/verify` (the sandbox
 holds `FLAG_BY_LEVEL`, the client never does) and writes `LabProgress(module='live_range', solved=True)`
 server-side. `GET /api/lab/completion` returns `arena_solved`/`range_solved`/`complete`/`credits_remaining`
 and drives `isChallenge2Unlocked()` via `window.__labComplete`. localStorage is now only a UI mirror.
 12. **Auto-reward 100 credits at 24/24, idempotent — fires from ALL completion paths.** When a user has
 all 12 Live Range + all 12 Arena solved, credit `paid_chats_remaining += 100` (chat credits, the existing
 field) ONCE. Implement with a `LabReward` table (unique `user_id`); `_award_completion_reward()` returns
 `None` if a row already exists, so re-posting / re-solving never double-credits. **CRITICAL (session 8
 regression):** the award must be called from `POST /api/lab/range/submit` AND `POST /api/lab/arena` AND
 `GET /api/lab/completion`. If it lives only in `range/submit`, then when the user's FINAL solve is an
 Arena level the award NEVER fires (the original bug — completion showed `complete:true, rewarded:false`).
 Add the `_award_completion_reward(db, user, request); db.commit()` call to BOTH submit routes and to the
 completion GET so any final solve credits. Untrusting: a user who solved only Live Range (12/12) gets
 `rewarded:false`.
 13. **Arena passes WITHOUT a live LLM — built-in deterministic training simulator (default).** Every
 Arena (Guardian) level is passable ON-PAGE via a deterministic simulator, independent of whether
 `OPENROUTER_API_KEY` is set. In `app/services/ai_service.py`, `stream_chat(messages, lab_arena=True,
 lab_secret=...)` routes to `_lab_arena_offline()` which returns a Guardian reply that LEAKS the secret
 whenever the user prompt contains an injection technique (ignore / override / "system:" / "dan" /
 "pretend" / "forget" / "roleplay" / "reveal" / "exfil" / "secret" / `<` / `{{` / etc). This makes all
 12 arenas always completable for training. **Routing rule:** `stream_chat` must check `if lab_arena:`
 BEFORE the `if not settings.OPENROUTER_API_KEY:` branch — otherwise a set key makes it call the real
 model, which is hardened and refuses to leak, breaking every level. To practice against a REAL model,
 set `LAB_ARENA_REALTIME=true` in `.env` (then `lab_arena=False` → live call). Grading: the route does
 `_normalize(secret) in _normalize(reply)`; the simulator always leaks so grading passes. Verify the
 simulator directly with `venv/bin/python -c "import asyncio; from app.services.ai_service import
 chat_completion; print(asyncio.run(chat_completion([...], lab_arena=True, lab_secret='MELLON')))"`.

15. **Live Range iframe carries the user's hacker/matrix theme.** The user runs the dashboard in
   the `cyberpunk` theme (neon green on black) and asked the Live Range (C1) iframe to match that
   "hackers-like theme". Re-theme `lab/runtime/labserve.py`'s `HTML` string with matrix green
   `#00ff41` on true-black, monospace, CRT scanlines + glow + terminal prompts. STRICT RULE:
   keep every CSS class and `:root` var name the served `<script>` references, or the level-card
   gating/unlock breaks — only change values, never the names (and define any NEW class you add).
   Known-good theme block + restart/verify recipe in `references/live_range_theme.md`.

14. Re-band ONE challenge's difficulty WITHOUT touching its exploits, and make C2 strictly harder
   than C1 (user directive: make challenge 2 more hard than challenge 1, increase it hard by level,
   and do not touch the first one). Do NOT change the vulnerability, flag, or endpoint of any level —
   that would break passability and violate the passable-if-you-try rule (rule #1/#3). Instead ONLY
   re-tier the difficulty labels in BOTH the Python LEVEL_META dict and the matching JS META array
   inside labserve.py's served frontend, keep bands monotonic per level, and add a new top tier above
   the other challenge's maximum. Recipe plus verification in references/reband_difficulty.md.
   Current banding: Arena (C1) = SLOW 1-3 to MEDIUM 4-7 to HARD 8-12; Live Range (C2) = MEDIUM 1-3 to
   HARD 4-8 to ELITE 9-12. ELITE is a new purple .lvdiff.elite band — add the CSS class AND a legend
   entry or it renders unstyled. After re-banding, re-run the per-level drive to PROVE every level
   still captures its flag; re-banding must change zero exploit bytes, only the band strings.

## BUILD (only if the user asks to re-add)
When the user gives a numbered list and says "build training rooms / rooms 1..N", they want a
**structured numbered catalog with real per-item content** — not just external links. The design
that satisfied them:
1. **Backend catalog:** `app/api/routes/training_rooms.py` → `TRAINING_ROOMS` list. Each room:
   `id` (`room-N`), `room` (int), `title`, `icon`, `category`, `summary`, `url`, `tags[]`,
   `deploy` (REAL copy-paste commands), `requirements`, `compatible` ∈ `server`|`this-device`|`vm-only`,
   optionally a `live` dict (see below) and `tasks[]` (quiz-style, only for reference-only rooms).
2. **Live sandbox runtime (synthetic, stdlib-only):** `lab/runtime/labserve.py` on `127.0.0.1:8080`,
   tmux `lailaba-lab`. NO external deps — `http.server` + `urllib` + `base64`/`hmac`/`hashlib` only.
   The rebuilt range uses **synthetic** scenarios (flags are hardcoded; injection is *simulated*, no
   real subprocess/host access) so it is safe on a personal device and ARM-runnable. Proven pattern:
   IDOR (trust `user=` param; admin order at `user=0`), JWT `alg=none` (verifier accepts `alg=none`
   with no signature check), simulated CMDi (concatenate `host` into a fake `ping` cmd; `;`/`$()`
   triggers a fake "leak"). Proxy is a route INSIDE `app/api/routes/lab.py`
   (`/runtime/{path:path}` → full `/api/lab/runtime/*`), NOT in `app/main.py` — needs
   `import httpx` + `from fastapi.responses import Response` there. Same-origin so the arena iframe
   works. Full known-good code in `references/live_range_rebuild.md`.
   **GATED LADDER variant (session 3):** when the user wants rising difficulty + one-by-one unlock,
   present the scenarios as 3 sequential LEVELS, not 3 side-by-side boxes. Difficulty curve:
   SLOW = trivial param flip (IDOR `user=0`); MEDIUM = forge a token (JWT `alg=none`, `sub=admin`);
   HARD = exploit + beat a guard (simulated CMDi with a WAF that blocks the literal word `flag`, so
   `;cat+/flag` is rejected and you must obfuscate with a glob like `;cat+/fl*` or `/f??g`). Gate
   client-side: Levels 2/3 are `locked` until the prior flag is captured; store solved levels in
   `localStorage` (`lailaba_range`), fill a progress bar, auto-scroll/unlock the next card on solve.
   The gate is a training aid (not a security boundary) — fine for a personal device.
3. **Frontend:** the live UI is `lab/` static files served at `/lab` (`lab/index.html` +
   `lab/js/app.js` + `lab/css/lab.css`). `app/templates/lab.html` + `app/static/js/lab.js` are
   DEAD/UNROUTED — never edit those. `renderRoomModal(room)`: if `room.live`, show a "Launch live
   lab" iframe + flag-capture input; else render `tasks[]` as quiz cards. The room rail lives in
   the Arena's right panel, not a tab.
   **Rebuilt pattern (2026-07-12):** rather than per-room modals, the Live Range is a single
   always-on card (`id="live-range-card"`) with an iframe `src="/api/lab/runtime/"` and a status
   pill that fetches `/api/lab/runtime/api/health`. See `references/live_range_rebuild.md`.
4. **Honesty rule:** never flag a room "running" unless you actually started it. `this-device`
   only if the runtime is present AND launches.
5. **Boot chain:** add a `lailaba-lab` block to `service-manager.sh` (absolute venv python path).
6. **Server restart needed for backend changes** (Python). JS/CSS/HTML are static — re-served on
   next request (hard-refresh the browser).

## REMOVE (complete teardown) — full steps in `references/removal_procedure.md`
Summary: revert modified tracked files via `git checkout HEAD -- …`, `rm` the untracked new
files/dirs, kill the `lailaba-lab` tmux session (do NOT `C-c` — see pitfall), strip its boot
block from `service-manager.sh`, restart `lailaba-server`, then verify `/lab` is Arena-only and
no `training`/`lab-runtime` references remain in served files.

## PITFALLS
- **Verify served paths, not just source (this cost a real bug).** We shipped "Launch live lab"
  pointing the iframe at `/lab-runtime-frame.html`, but the page is mounted under `/lab/` so the
  real URL is `/lab/lab-runtime-frame.html` → the iframe loaded a 404 in the browser while every
  `curl …/lab-runtime/…` proxy test passed. After ANY frontend change: `curl` the *served* asset
  and grep it for the exact paths/IDs the JS uses; also grep the served `index.html` for stale
  element IDs. Server-side proxy success ≠ browser success.
- **Absolute `fetch` paths break under the proxy (second real bug, session 3).** The range frontend
  initially used ABSOLUTE fetch URLs like `fetch('/api/orders?user=0')`. Loaded via the iframe at
  `/api/lab/runtime/`, an absolute path resolves against the FastAPI origin → `http://host:8000/api/orders`
  (which FastAPI doesn't have) → browser shows `{"detail":"Not Found"}` even though the iframe and
  the status pill (which hit `/api/lab/runtime/api/health`) both worked. My curl tests passed only
  because they hit the proxy path directly, never the absolute sub-path. FIX: build every request
  RELATIVE to the iframe's own base:
  ```js
  const BASE = (location.pathname.endsWith('/') ? location.pathname
    : location.pathname.replace(/\/[^/]*$/, '/'));
  const rel = v => BASE + ((v||'').trim().startsWith('/') ? v.slice(1) : v);
  fetch(rel('api/orders?user=0'));
  ```
  This works whether the page is served directly from `:8080` OR proxied under `/api/lab/runtime/`.
  After ANY frontend change, re-test the actual endpoint calls through the proxy, not just the page
  load. Also: a button that should POST a token must send `Authorization: Bearer <token>` via fetch —
  wiring the token string itself as a URL (old bug) returns `undefined` then 404.
- **The agent's tool wrapper SIGTERMs raw shell `pkill` + `tmux kill-session` + `&` restart sequences.** When you chain `pkill -f uvicorn; sleep 1; tmux new-session -d -s ...; sleep 4; <probe>` in ONE foreground `terminal` call (or use `&` backgrounding), the wrapper returns `exit_code: -15` and the server never actually comes back up — the launch line gets killed before uvicorn binds. **Correct restart pattern:** do the kill in one short call, then launch via `terminal(background=true)` (the Lailaba background-process runner) and `process(action='wait')` for readiness, OR use `tmux new-session -d -s NAME "<launch cmd>"` and verify in a SEPARATE follow-up call. Never rely on `sleep` + inline `&` in a foreground command. Symptom of the trap: `curl :8000` returns `000`/connection-refused right after a "restart" that printed nothing.
- **tmux `C-c` KILLS THE SESSION** (critical): `tmux send-keys -t SESSION C-c` on a foreground
  `exec` process terminates the pane and the *whole session* dies. To restart `lailaba-server` /
  `lailaba-lab`, do NOT send C-c; instead `tmux new-session -d -s NAME -x 200 -y 50` then
  `tmux send-keys -t NAME "…launch cmd…" Enter`. (Sessions run a raw `exec uvicorn …` / `exec
  python3 …`, not an interactive shell, so C-c = die.)
- **Lab runtime relative venv path fails silently:** when launching `labserve.py` from
  `lab/runtime/`, use the ABSOLUTE venv python
  (`/data/data/com.termux/files/home/lailaba-ai/venv/bin/python3`), not `../venv/bin/python3` —
  the relative form resolves to a non-existent `lab/venv` and the session shows no process (server
  returns 000).
- **Rate-limiter 429 looks like an outage:** `app/main.py` `rate_limiter` = 20/min per client IP,
  and **localhost (127.0.0.1) counts against the same budget**. Rapid `curl` probe loops trip
  `429`. This is NOT a fault — space out probes (≤1 call per check). Whitelist loopback by adding
  - **Browser page-load burst trips the rate limiter → fake "offline" pill (this cost a real session).** `app/main.py` `rate_limiter` caps 20 req/min per client IP, and **the browser IS a loopback client (127.0.0.1)**. On every `/lab` load the browser fires a *burst* at once: `/api/lab/challenges`, `/api/lab/progress`, the iframe `/api/lab/runtime/`, its `/api/lab/runtime/api/health` probe, plus `/sw.js` and `/lab/` assets. That burst exceeds 20/min → the Live Range health probe returns `429` → `fetch().ok` is false → the status pill renders **"offline"** even though `curl` from the CLI succeeds (curl sends one quiet request). Symptom: "Live Range … offline" while the server is actually up; server logs show `GET /api/lab/runtime/api/health … 429 Too Many Requests`. **The old advice ("whitelist loopback" / "space out curl probes") does NOT fix this** — you can't tell the browser to space out its asset loads, and the browser is already loopback. **Correct fix:** exempt the *local training/PWA surface* from the limiter by path prefix in `rate_limiter` (real attack surface — auth/chat/admin/payment — stays throttled):
    ```python
    _p = request.url.path
    if (_p.startswith("/static") or _p.startswith("/lab") or _p.startswith("/api/lab")
            or _p in ("/sw.js", "/manifest.json", "/health")):
        return await call_next(request)
    ```
    After the fix, a 40-request parallel page-load burst returns **0 × 429** (diagnosis transcript + burst-verify script in `references/rate_limit_429_fix.md`).
- **Do NOT hand-retype near-identical identifier strings — you WILL transcribe them wrong and waste a session.** This session lost ~10 tool calls to the typo `serve_forever` vs `serve_forever` (the `http.server` method). Eyeballing `serve_forever`/`serve_forever` is impossible; every manual "fix" re-typed the SAME wrong spelling. **Correct technique:** (1) get the canonical form from the runtime, e.g. `python3 -c "import http.server;print([m for m in dir(http.server.ThreadingHTTPServer) if 'serve' in m])"` → `['serve_forever']`; (2) if you must match-and-replace, dump exact bytes (`od -c`, or `repr(line)` / `[ord(c) for c in s]`) and let Python's `re.sub` do the replacement against those exact bytes — never retype the string yourself; (3) after editing, restart and `curl`/`ps` to confirm it STAYS up (a NameError exits instantly, so a process that isn't in `ps` = it crashed on import/start). The same trap applies to any long near-homoglyph token (JWT `alg=none`, base64 blobs, CSS hex colors). When in doubt, copy the canonical bytes, don't recreate them.
- **The `patch` tool corrupts multi-line JS when you put `\n` inside `new_string`.** This session
  burned a block: when `old_string` contained real newlines but `new_string` used literal `\n` to
  separate lines, the tool inserted the `\n` as LITERAL backslash-n characters (one giant corrupted
  line), not actual line breaks. Symptom: a 90-line function collapses into `...\\n...` on a single
  line and `node --check` fails (or worse, parses but misbehaves). **Correct technique:** for any
  multi-line insert, either (a) paste REAL newlines into `new_string` (not `\n`), or (b) after a bad
  patch, repair with `execute_code` (read the file, replace the corrupted line via `lines[idx]=correct_block`,
  write back), then `node --check`. Never hand-edit large JS blocks through `patch` with escaped newlines.
- **Auth/reward verification needs a real (test) user via the venv python, NOT system `python3`.** The
  server venv has `sqlalchemy`; system `python3` does NOT → `ModuleNotFoundError`. To verify the 24/24
  reward end-to-end: register+login a throwaway user over HTTP (`/api/auth/register` needs
  `confirm_password`), solve all 12 Live Range via `POST /api/lab/range/submit`, then (since no live LLM)
  write 12 `LabProgress(module='arena', solved=True)` rows directly with `venv/bin/python`, call
  `_award_completion_reward()`, and assert `GET /api/lab/completion` shows `complete:true,\n  rewarded:true, credits_awarded:100` and a SECOND award call returns `None` (no double-credit).\n  Wrong-flag submit must return `correct:false`. Full recipe in `references/auth_and_reward.md`.
- **A standalone helper test passing does NOT prove the live ROUTE works (cost a real session).** A
  `venv/bin/python` script that imports `chat_completion` directly and leaks fine can still hide a 500
  on the actual endpoint, because the *route module* may lack an import the helper script didn't need.
  This session: `arena_attack()` referenced `settings.LAB_ARENA_REALTIME` but `settings` was never
  imported into `app/api/routes/lab.py` → every Arena call returned `500 Internal Server Error` with an
  empty body, while the standalone simulator test passed. **Discipline:** after wiring a route, hit the
  ROUTE over HTTP (not just the helper) and read the server's stderr for the traceback — `curl` only
  shows `Internal Server Error` with no detail. Always `import` every symbol a route references
  (esp. `from app.core.config import settings` when touching `settings.*`).
- **Duplicate/stale uvicorn on :8000 serves OLD code — kill ALL before relaunching.** Running more than
  one uvicorn (parent+child from `--workers 1` is normal = 2 PIDs; that's fine) OR a leftover instance
  from a previous edit means `curl` hits whichever still holds the port, so your new code "doesn't
  take effect" and you chase phantom bugs. `ps aux | grep [u]vicorn` then `pkill -9 -f uvicorn`, sleep,
  confirm `ss -ltn | grep 8000` is free, THEN start one fresh `terminal(background=true)` instance. The
  user's machine also emits delayed "Application startup complete" / "listening on" notifications from
  DEAD background processes (rewrite-era crash victims) — treat `ps` + `curl` as authoritative, not the
  notification text.
- **`pkill -f "python3 lab/runtime/labserve.py"` self-match also SIGTERMs your shell** (hit
  2026-07-13). The pattern matches the very bash running the command, so it kills the shell
  (exit `-15`) and the OLD labserve survives while the relaunch never fires — leaving :8080 DOWN.
  SAME family as the uvicorn trap. Fix: launch via `tmux new-session -d -s live-range 'python3
  lab/runtime/labserve.py'` (the keyword is inside the tmux string, not the guarded outer
  command), or use the bracket trick `pkill -9 -f "[l]ab/runtime/labserve.py"`. Verify after restart
  with `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/health` (expect 200),
  not just the tmux banner.
- **Page endpoint paths are ALL `/api/`-prefixed; the proxy only forwards `/api/*`.** Verify each level
  through the EXACT same-origin proxy path the page uses (`/api/lab/runtime/...`), NOT the raw sandbox
  path. The proxy whitelist is `/api/health`, `/api/token`, `/api/orders`, `/api/admin`, `/api/ping`,
  `/`, `/index.html` and anything starting with `/api/`. So `/redirect`, `/metadata`, `/files`,
  `/metadata6` (bare) return 404 through the proxy — the page calls them as `/api/redirect`, `/api/fetch`
  etc., which DO work. Also confirm the flag is VISIBLE in the response text the page checks: L4 must
  return the flag as a top-level JSON field (not only base64-encoded inside the JWT), and L12's
  `/api/unpickle` must extract the `pickle` JSON field before base64-decoding (decoding the whole JSON
  body fails). Full per-level drive recipe in `references/drive_all_24_levels.md`.
- **Two frontends trap:** editing `app/static/js/lab.js` / `app/templates/lab.html` changes
  nothing visible — the live UI is `lab/js/app.js`. Verify which is served.
- **Boot guard vs live listener:** `service-manager.sh` guards on `tmux has-session` only, not a
  listening process. If a stale PID holds `:8000`, the new instance hits "address already in use"
  and exits. `kill` the stale PID before relaunching.
- **Cronjob `script` path rule:** `cronjob create` with `script=` rejects absolute paths / paths
  outside `~/.lailaba/scripts/`. Copy the script there first, then pass just the basename.
  `no_agent=true` + `deliver=local` for watchdog jobs; `every 2m` is valid.

- **Stripping training/quiz modules must NOT delete the live sandbox.** A prior cleanup removed the
  *entire* Lab (quiz drawer + 14-room catalog + `labserve.py` + proxy) under one "remove it all".
  But the live sandbox was the user's desired **"demo working environment"** — only the quiz/tab layer
  was unwanted, not the sandbox. The Lab then became arena-only and contradicted the directive
  "provide a demo working environment, not only questions". Rule: when removing the catalog/quiz UI,
  KEEP `lab/runtime/labserve.py`, the `/api/lab/runtime/*` proxy, the Live Range card, and the
  `lailaba-lab` boot block. Delete only the *catalog/training* artifacts.

## Verification (real tool output, not assumed)
- Served frontend (catches the iframe-path class of bug):
  `curl -s http://127.0.0.1:8000/lab/ | grep -oE 'id=(level-rail|arena-card|arena-chat|live-range-card|live-range-frame)'` → expect Arena + Live Range IDs.
  `curl -s http://127.0.0.1:8000/lab/ | grep -oE 'training-panel|training-modal|Training Modules' || echo "no training artifacts"` → none.
  `curl -s http://127.0.0.1:8000/lab/js/app.js | grep -c "live-panel"` → 0 when removed.
- Backend rooms (when built): `curl -s http://127.0.0.1:8000/api/lab/training/rooms | python3 -c "import sys,json;print([(r['id'],'live' in r) for r in json.load(sys.stdin)['rooms']])"`
- Live exploit via proxy (each runnable room yields its own flag), e.g.:
  `curl -s "http://127.0.0.1:8000/api/lab/runtime/api/orders?user=0"` → contains FLAG{idor...}
  (proxy path is /api/lab/runtime/* — the api router already carries /api/lab; there is NO /lab-runtime/ mount)
- Gated-ladder level checks (session 3): the proxy serves the SAME-ORIGIN sub-paths, and the
  frontend gates via localStorage. Verify each level is solvable through the proxy AND that the
  WAF on the HARD level behaves:
  `curl -s "http://127.0.0.1:8000/api/lab/runtime/api/ping?host=8.8.8.8;cat+/flag&waf=1"` → `{"blocked":true}` ("flag" literal rejected)
  `curl -s "http://127.0.0.1:8000/api/lab/runtime/api/ping?host=8.8.8.8;cat+/fl*&waf=1"` → contains FLAG{cmdi...} (glob defeats WAF)
  `curl -s "http://127.0.0.1:8000/api/lab/runtime/api/health"` → `{"levels":12,"scenarios":[...SLOW,MEDIUM,HARD]}`
- Health: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/health` → `200`.
- **Burst test (proves the rate-limiter fix; the browser's page-load burst no longer 429's).** The tool shell rejects `&` backgrounding, so fire a Python thread burst (loopback, mirrors the browser). Expect `429 count = 0`:
  ```python
  import threading, urllib.request, urllib.error
  base='http://127.0.0.1:8000'
  paths=['/api/lab/runtime/api/health']*8 + ['/api/lab/challenges']*6 + ['/api/lab/progress']*6 + ['/api/lab/runtime/']*6 + ['/sw.js']*4 + ['/lab/']*4 + ['/health']*4 + ['/manifest.json']*2
  codes=[]; lock=threading.Lock()
  def hit(p):
      try: c=urllib.request.urlopen(base+p, timeout=8).getcode()
      except urllib.error.HTTPError as e: c=e.code
      with lock: codes.append(c)
  ts=[threading.Thread(target=hit,args=(p,)) for p in paths]
  [t.start() for t in ts]; [t.join() for t in ts]
  print('429 count =', codes.count(429), '(must be 0)')
  ```
- Runtime up (when built): `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/` → `200`; `tmux list-sessions | grep lailaba-lab`.

## Pointers
- `references/verify_on_device.md` — the verify-on-device discipline + the iframe-path bug + checklist.
- `references/removal_procedure.md` — exact teardown steps (git checkout, rm, kill session, boot block, restart).
- `references/live_range_rebuild.md` — known-good rebuild recipe for the synthetic Live Range (labserve.py, proxy route, arena card, auto-start, verify commands). Includes the GATED LADDER variant (SLOW→MEDIUM→HARD, one-by-one unlock, localStorage progress, WAF-bypass on HARD).
- `references/arena_gated_ladder.md` — Arena (Guardian) SLOW/MEDIUM/HARD gated-ladder recipe: add `diff` bands to LEVELS[], lock the rail via `isUnlocked()`, band CSS, and the "do it also for arena" consistency rule.
- `references/rate_limit_429_fix.md` — the browser-burst 429 bug: root cause (loopback client, page-load burst), the WRONG old advice, the path-exemption fix, and a Python burst-verify script.
- `references/one_at_a_time_mode.md` — strict one-at-a-time game mode (vs gated ladder): currentLevel()/render()/mark()/nextLevel() recipe, resume-on-reload, verify grep (no next card in DOM), node sim.
- `references/challenge_gating.md` — Challenge 1/Challenge 2 nested game-progression: same-origin iframe + shared localStorage + postMessage reveal, HTML/CSS/JS predicates, node-sim verification, pitfalls (hidden attr, counter drift, hard-refresh).
- `references/swap_challenge_order.md` — flip which sub-feature is C1 vs C2 (Live-Range-first is the VERIFIED current order).
- `references/verify_gating_headless.js` — node script proving C2 stays locked until Live Range (C1) done; run after any gating/js edit.
- `references/e2e_verify_24.py` — register a throwaway user over HTTP, drive all 24 levels through the real routes, assert reward fires + is idempotent. Run after any Lab change before declaring done.
- `references/auth_and_reward.md` — AUTH-GATED Live Range progress + auto 100-credit reward: endpoints, /api/verify anti-spoof, LabReward idempotency, end-to-end verification recipe (test user via venv python).
- `references/reband_difficulty.md` — re-band ONE challenge's difficulty (ELITE tier, META arrays, keep exploits, verify still solvable).
- `references/live_range_theme.md` — re-theme the Live Range iframe to the hacker/matrix (cyberpunk) look: keep CSS class/var names so gating survives, known-good matrix-green block, restart via tmux `live-range` + verify.
- `references/drive_all_24_levels.md` — exact recipes to DRIVE every one of the 24 levels the way the page does (Live Range via the /api/lab/runtime proxy + /api/lab/range/submit; Arena via /api/lab/arena with injection prompts), plus the "standalone test passed but route 500'd" and "stale uvicorn on :8000" pitfalls.
