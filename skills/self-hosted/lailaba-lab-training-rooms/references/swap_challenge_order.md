# Swapping Challenge 1 / Challenge 2 order (Arena vs Live Range)

The Lab has exactly two challenges on the `/lab` page: **Arena "Break the Guardian"**
and **Live Range**. The user may want either as Challenge 1 (the always-visible opening)
and the other as Challenge 2 (hidden until C1 is fully solved).

## CURRENT ORDER (session 10, 2026-07-12 — VERIFIED)
**LIVE RANGE = Challenge 1** (always visible on-device sandbox), **ARENA "Break the Guardian" =
Challenge 2** (hidden until all 12 Live Range levels solved). This is the user's original spec
and was verified end-to-end in session 10. Session 9 briefly set Arena=C1, but that was REVERTED
because the spec is Live-Range-first. If the page shows Arena first, that is the INVERTED (wrong) state.

## What to change (both files) — to SET the CORRECT Live-Range-first order
1. `lab/index.html`
   - Chip labels: `chip-1` → "Live Range", `chip-2` → "Break the Guardian".
   - Sections: the LIVE RANGE `<section id="challenge-1">` has NO `hidden` attr.
     The ARENA `<section id="challenge-2" hidden>` carries `hidden` + the
     `#challenge-2-locked` 🔒 placeholder (text: "Complete all 12 Live Range levels to unlock…").
   - Locked placeholder tracks C1 via `locked-range-count` and reads
     "Complete all 12 Live Range levels (Challenge 1) to unlock Challenge 2 — the 12-level Arena".
2. `lab/js/app.js` (gating block)
   - `isChallenge2Unlocked()` keys off LIVE RANGE completion:
     `window.__labRangeComplete === true || rangeSolvedCount() >= RANGE_TOTAL`
   - `refreshCompletion()` sets `window.__labRangeComplete = c.range_solved >= RANGE_TOTAL`
     (reads `GET /api/lab/completion`).
   - chip-1 `.ch-sub` shows `n / RANGE_TOTAL solved`; the locked placeholder uses `locked-range-count`.
   - `onChallenge2Complete()` just calls `unlockChallenge2(true)`.

## Verify after swap (served files, not source)
```
curl -s http://127.0.0.1:8000/lab/ | grep -E 'ch-label|id="challenge-1"|id="challenge-2"|locked-(arena|range)-count'
curl -s "http://127.0.0.1:8000/lab/js/app.js?v=12" | grep -nE '__labArenaComplete|arenaSolvedCount|locked-arena-count'
```
Expect: chip-1 label = the new C1, challenge-1 section NOT hidden, challenge-2 section hidden,
the served app.js carries the C1-first gating drivers. Static files need only a browser
hard-refresh (no server restart).

## Gotchas
- The `hidden` HTML attribute is overridden by `display:flex/grid` in CSS. Always pair a hidden
  section with `#challenge-2[hidden]{display:none}` in lab.css or it renders anyway.
- Don't touch the backend reward logic — it's order-agnostic (fires at arena_solved>=12 AND
  range_solved>=12 regardless of which is C1). Only the *front-end* visibility flips.
- `ARENA_TOTAL` / `RANGE_TOTAL` are both 12; keep them equal to the real level counts or C2
  never unlocks.
