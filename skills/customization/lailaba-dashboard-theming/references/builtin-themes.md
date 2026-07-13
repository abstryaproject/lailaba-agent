# Built-in Lailaba Dashboard Themes

Source of truth: `web/src/themes/presets.ts` in the hermes-agent repo
(`~/.hermes/hermes-agent/`). Palettes are dark-paint-on-canvas except
`nous-blue` (which inverts to light mode via a `mix-blend-mode: difference`
layer).

| name          | label            | description                          | bg hex    | midground hex | terminal bg | accents (overrides)                         |
|---------------|------------------|--------------------------------------|-----------|---------------|-------------|---------------------------------------------|
| default       | Lailaba Teal     | Classic dark teal — canonical look   | #041c1c   | #ffe6cb       | #000000     | —                                           |
| default-large | Lailaba Teal (L) | Teal, bigger fonts, roomier spacing  | #041c1c   | #ffe6cb       | #000000     | —                                           |
| nous-blue     | Nous Blue        | Light mode — Nous-blue on cream      | #170d02*  | #FFAC02*      | #000000     | destructive #04d3c9, success #b5217f, warning #0042c7 |
| midnight      | Midnight         | Deep blue-violet, cool accents       | #0a0a1f   | #d4c8ff       | —           | —                                           |
| ember         | Ember            | Warm crimson & bronze — forge vibes  | #1a0a06   | #ffd8b0       | —           | destructive #c92d0f, warning #f97316       |
| mono          | Mono             | Clean grayscale — minimal & focused  | #0e0e0e   | #eaeaea       | —           | —                                           |
| cyberpunk     | Cyberpunk        | **Neon green on black — matrix**     | #040608   | #9bffcf       | —           | success #00ff88, warning #ffd700, destructive #ff0055 |
| rose          | Rosé             | Soft pink & warm ivory               | #1a0f15   | #ffd4e1       | —           | —                                           |

* `nous-blue` authoring colors are dark; the inversion layer flips them on
  screen to a cream canvas with vivid Nous-blue accents.

## "Hackers-like" mapping
User phrasing "hackers theme" / "matrix look" / "green terminal" → **`cyberpunk`**.
Set with: `lailaba config set dashboard.theme cyberpunk`

## Where the list lives
- Frontend built-ins: `web/src/themes/presets.ts` (`BUILTIN_THEMES` map).
- Backend label/description list + persistence: `lailaba_cli/web_server.py`
  (`_BUILTIN_DASHBOARD_THEMES`, `get_dashboard_themes`, `set_dashboard_theme`).
- User themes discovered from: `~/.lailaba/dashboard-themes/*.yaml`.
