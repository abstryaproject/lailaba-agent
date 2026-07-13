---
name: lailaba-cli-theming
description: Change the CLI / TUI agent's OWN visual appearance (colors, look) via the skin engine. Covers the config key, built-in skins, creating a custom skin YAML, and the critical distinction from the web dashboard theme. Trigger on "change my theme", "green-on-black", "matrix look", "hackers theme", "the colors are gold", "make it look like X" while in or talking about the CLI/TUI.
---

# Lailaba CLI / TUI Theming (the skin engine)

Change how the **CLI / TUI agent itself** looks — its gold banner, response-box
border, status bar, prompt colors, etc.

## CRITICAL — CLI skin vs web dashboard theme (read first)

These are TWO DIFFERENT systems. Mixing them up is the single most common
mistake here:

- **Web dashboard theme** → config key `dashboard.theme` (e.g. `cyberpunk`).
  Controls the *web* dashboard only. See the `lailaba-dashboard-theming` skill.
- **CLI / TUI appearance** → config key `display.skin` (a skin name). Controls
  the *terminal* agent you're talking to right now.

The CLI's default gold look is the `default` **skin**, NOT a dashboard theme.
When a user in the CLI says "change my theme / make it green-on-black / hackers
look", they mean the **CLI skin**, not `dashboard.theme`. Do NOT set
`dashboard.theme` for a CLI color request — that only touches the web dashboard
and the user will say "I meant the CLI". (This happened once; encode it.)

## How CLI theming works

- Engine lives in `lailaba_cli/skin_engine.py`. A skin is a YAML dict of color
  keys (hex for Rich markup / ANSI), plus optional `branding`, `spinner`,
  `tool_emojis`, `tool_prefix`.
- The active skin is read at startup from `display.skin` in
  `~/.lailaba/config.yaml`.
- No built-in green/matrix skin ships. If the user wants green-on-black, you
  must CREATE a user skin (see template `templates/hackers.yaml`).

### Built-in skins (for reference)
`default` (gold/kawaii), `ares` (crimson/bronze), `mono` (grayscale),
`slate` (cool blue), `daylight` (light bg), `warm-lightmode` (dark text on
light), `poseidon` (deep blue/seafoam), `sisyphus` (austere grayscale),
`charizard` (burnt orange/ember). List them live with
`python -c "from lailaba_cli.skin_engine import list_skins; print(list_skins())"`.

## Steps to apply a green-on-black / hackers look

1. **Create the skin file** (do NOT edit any bundled source):
   `~/.lailaba/skins/hackers.yaml` — copy `templates/hackers.yaml` from this
   skill and adjust. Colors are `#RRGGBB` hex. Key accents:
   `banner_title`, `banner_border`, `response_border`, `ui_accent`, `prompt`.
2. **Activate via the CLI** (config.yaml is guard-railed — never hand-edit it;
   use the config setter):
   `lailaba config set display.skin hackers`
   (If `lailaba` isn't on PATH:
   `~/.hermes/hermes-agent/venv/bin/lailaba config set display.skin hackers`)
   The user can also type `/skin hackers` inside a running CLI session.
3. **Verify it resolves** before declaring done:
   ```python
   import yaml
   cfg = yaml.safe_load(open('/data/data/com.termux/files/home/.lailaba/config.yaml'))
   from lailaba_cli.skin_engine import init_skin_from_config, get_active_skin_name, get_active_skin
   init_skin_from_config(cfg)
   print(get_active_skin_name(), get_active_skin().get_color('banner_title'))
   # expect: hackers  #00ff88
   ```
4. **Apply**: the look takes effect on the NEXT CLI session — tell the user to
   exit and re-run `lailaba`. No web-server restart needed (different system).

## Pitfalls
- **Wrong config section**: the skin key is `display.skin`, NOT `dashboard.skin`
  and NOT `dashboard.theme`. Setting it under the wrong section is silently
  ignored.
- **Guard-rail**: direct edits to `~/.lailaba/config.yaml` via editor/patch tools
  are BLOCKED ("Agent cannot modify security-sensitive configuration"). Always
  go through `lailaba config set`.
- **No built-in green**: don't waste time looking for a matrix skin — create one.
- **Restart the CLI, not the server**: a running session won't recolor until
  relaunched; the web-dashboard refresh advice does not apply here.
- **Gold is hardcoded fallback**: `cli.py` hardcodes `#FFD700` as a fallback when
  a skin color is missing, so a partial skin may still show gold specks — define
  the full color set (see `references/skin-schema.md`).
- **User skins persist across updates**: they live in `~/.lailaba/skins/`, outside
  the bundled source, so they survive agent upgrades.

## Switching back / off
`lailaba config set display.skin default` (or `/skin default` in-session).

## References
- `references/skin-schema.md` — every color key with its meaning and the
  hacker-green values, condensed from `skin_engine.py`.
- `templates/hackers.yaml` — a ready-to-use neon green-on-black matrix skin.
  Copy to `~/.lailaba/skins/hackers.yaml`, tweak, activate.
