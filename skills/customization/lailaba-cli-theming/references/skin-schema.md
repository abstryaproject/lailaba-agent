# CLI Skin color schema (condensed from lailaba_cli/skin_engine.py)

A skin is a YAML file at `~/.lailaba/skins/<name>.yaml`. All color keys are
optional; missing ones inherit from the `default` skin. Values are `#RRGGBB`
hex (or ANSI for `response_border`).

## Color keys

| Key | Meaning | Hacker-green value |
|-----|---------|--------------------|
| `banner_border` | Panel border color | `#00ff66` |
| `banner_title` | Panel title text color | `#00ff88` |
| `banner_accent` | Section headers (Available Tools, etc.) | `#39ff14` |
| `banner_dim` | Dim/muted text (separators, labels) | `#1f8f4a` |
| `banner_text` | Body text (tool/skill names) | `#9bffcf` |
| `ui_accent` | General UI accent | `#00ff88` |
| `ui_label` | UI labels | `#39ff14` |
| `ui_ok` | Success indicators | `#00ff66` |
| `ui_error` | Error indicators (keep readable) | `#ff0055` |
| `ui_warn` | Warning indicators | `#ffd700` |
| `prompt` | Prompt text color | `#39ff14` |
| `input_rule` | Input area horizontal rule | `#00ff66` |
| `response_border` | Response box border (ANSI) | `#00ff88` |
| `status_bar_bg` | Status bar background | `#040806` |
| `status_bar_text` | Status bar default text | `#9bffcf` |
| `status_bar_strong` | Status bar highlighted text | `#00ff88` |
| `status_bar_dim` | Status bar separators/muted | `#1f8f4a` |
| `status_bar_good` | Healthy context usage | `#00ff66` |
| `status_bar_warn` | Warning context usage | `#ffd700` |
| `status_bar_bad` | High context usage | `#ff8c00` |
| `status_bar_critical` | Critical context usage | `#ff0055` |
| `session_label` | Session label color | `#39ff14` |
| `session_border` | Session ID dim color | `#1f8f4a` |
| `voice_status_bg` | TUI voice status background | `#040806` |
| `selection_bg` | TUI mouse-selection highlight | `#0a3d1f` |
| `completion_menu_bg` | Completion menu background | `#040806` |
| `completion_menu_current_bg` | Active completion row | `#0a3d1f` |
| `completion_menu_meta_bg` | Completion meta column bg | `#040806` |
| `completion_menu_meta_current_bg` | Active completion meta | `#0a3d1f` |

## Non-color keys (optional)
- `branding`: `agent_name`, `welcome`, `goodbye`, `response_label`,
  `prompt_symbol`, `help_header` (strings).
- `spinner`: `waiting_faces`, `thinking_faces`, `thinking_verbs`, `wings`
  (list of `[left, right]` pairs).
- `tool_emojis`: per-tool emoji overrides.
- `tool_prefix`: single char for tool output lines (default `┊`).

## Note on cli.py hardcoded fallback
`cli.py` defines `_ACCENT_ANSI_DEFAULT = "\033[1;38;2;255;215;0m"` (#FFD700 gold)
used when a color is missing/unparseable. A partial skin may still show gold
specks — define the full set above to avoid them.
