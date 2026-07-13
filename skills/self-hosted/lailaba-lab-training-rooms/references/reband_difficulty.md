# Re-band ONE Lab challenge's difficulty (ELITE tier)

When the user wants Challenge 2 harder than Challenge 1, or "increase difficulty by level" on
just ONE challenge, ONLY re-tier the difficulty labels — never the exploit. This honors the
'passable if you try' hard rule (rule #1/#3 in the umbrella SKILL.md).

## The pattern
- Keep every endpoint, flag, and solution byte-for-byte identical.
- Change only the band string in TWO places (they must match exactly):
  1. Python `LEVEL_META` dict in `lab/runtime/labserve.py` — `("BAND", "Title", "desc", "/path", "METHOD")`.
  2. The served JS `const META = { 1:['BAND','Title',...], ... }` inside the same file's `FRONTEND_HTML`.
- Make bands MONOTONIC increasing by level (each level ≥ previous). Gaps are fine (e.g. jump
  MEDIUM→HARD). This mirrors the Guardian Arena's `DIFF_LABEL` feel (rule #6).
- Add a new top tier ABOVE the other challenge's max so C2 reads strictly harder.

## This session's concrete result (re-banding Live Range = C2, leaving Arena = C1 untouched)
- Arena (C1) = SLOW 1-3 → MEDIUM 4-7 → HARD 8-12.  (UNCHANGED)
- Live Range (C2) = MEDIUM 1-3 → HARD 4-8 → ELITE 9-12.  (re-banded up one tier + new ELITE)
- ELITE is a NEW band: add CSS
  `.lvdiff.elite{background:rgba(189,147,249,.18);color:#bd93f9;border:1px solid #bd93f9}`
  and a legend entry `<span><b>ELITE</b> chained / evasive</span>`. Without BOTH the label
  renders unstyled.
- Header text updated to "Challenge 2" + "MEDIUM → HARD → ELITE, climbs one notch every level".
- Completion banner reworded (it is the FINAL step now — no longer "unlock Challenge 2").

## Pitfalls
- JS `META` bands must EXACTLY match `LEVEL_META` bands (same count, same ordering) or the
  served page shows wrong labels / a mismatch on re-render.
- Don't touch Arena at all when re-banding only C2 — the user said "don't touch the first one".
- Restart the sandbox after editing `labserve.py`: `pkill -9 -f lab/runtime/labserve.py`, then
  relaunch via `terminal(background=true)`. It's a Python process — static re-serve does NOT
  apply (rule: server restart needed for backend/Python changes).

## Verify (prove exploits unchanged)
Drive all 12 C2 levels through the proxy (`references/drive_all_24_levels.md`) and assert each
flag substring is present. Expect "ALL 12 STILL PASSABLE ON PAGE: True". Re-banding must change
zero exploit bytes, so this stays green. Also grep the served `/api/lab/runtime/` for the new
bands (L1 MEDIUM … L12 ELITE) and confirm "ELITE" appears in the legend.
