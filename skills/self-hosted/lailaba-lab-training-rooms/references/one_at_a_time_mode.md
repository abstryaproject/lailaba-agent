# One-at-a-time game mode (Live Range / Challenge 1)

When the user says "show level one-by-one like in game mode" / "increase level to at least 12" /
"chalage to be one by one", they want STRICT single-level reveal — NOT the gated-ladder
(which renders all N cards and greys out the locked ones). Strict mode shows ONLY the
current level; the next appears only after the current flag is captured.

## Distinct from the gated ladder
- **Gated ladder** (rule #5 / BUILD step 2): all N cards in the DOM, locked ones
  greyed/disabled, unlock-on-solve. The user still SEES the whole ladder.
- **One-at-a-time**: only render `currentLevel()` (first unsolved). No other card exists in
  the DOM. On solve, show a "Next →" button; clicking repaints ONLY the current level.
  This is the stricter "like a game" feel the user asked for on Challenge 1.

## Recipe (the iframe frontend served by labserve.py)
- State: `solved = JSON.parse(localStorage[KEY] || '[]')`.
- `currentLevel()`: scan 1..TOTAL, return first `!isSolved(n)`; if none, return
  TOTAL+1 (done). This makes it **RESUME on reload** — reopen straight at the first
  unsolved level, never flashing earlier ones.
- `render()`: build a SINGLE card for `n = currentLevel()`; header "LEVEL n / TOTAL" +
  diff band; wire the method-specific control (GET input, POST input, FORGE
  token→admin). Hide `#done-banner` unless `n > TOTAL`.
- `mark(n, ok)`: if ok && !solved, push n, save, update progress bar; append a
  "✓ Level n solved! [Next →]" span that calls `nextLevel()`.
- `nextLevel()`: `render()` again (repaints only the now-current level).
- On `solved.length === TOTAL`: show `#done-banner`, call `notifyParent()`
  (`postMessage` + localStorage `lailaba_range_done`).

## Critical correctness points
- The iframe MUST still write the FULL solved array to
  `localStorage['lailaba_range_v12']` (all 12 ids). The parent (`app.js`) reads that
  key to unlock Challenge 2. One-at-a-time only changes what is *displayed*, not what
  is *stored*.
- `RANGE_TOTAL` in the iframe AND `RANGE_TOTAL` in the parent (`app.js`) must BOTH
  equal the real level count (12). If they drift, Challenge 2 never unlocks.
- The "Next" button must call `render()` (repaint), not just scroll — there is no next
  card in the DOM yet.
- Keep requests base-relative (BASE/rel helper) — absolute paths break under the
  `/api/lab/runtime/` proxy (see PITFALLS in SKILL.md).
- Bump `RANGE_VERSION` in the served HTML when the ladder changes, so returning users
  don't see a stale single-card state. (The parent `app.js` already uses `?v=` on its
  own script tag; the iframe shares the same origin so a version bump there also helps.)

## Verify (real output)
- Fresh load of `/api/lab/runtime/` → grep shows `LEVEL 1 / 12` and `id="i1"`,
  but NO `id="i2"` (no level-2 card in the DOM).
- Node sim of the predicates:
  `currentLevel()` = 1 fresh; after marking 1..11 → returns 12 (NOT 2); after 12 →
  TOTAL+1 (done) and `solved.length === 12` (parent unlocks C2).
- `curl .../api/lab/runtime/api/health` → `{"levels":12, ...}` confirms the backend.
