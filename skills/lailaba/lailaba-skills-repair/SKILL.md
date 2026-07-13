---
name: lailaba-skills-repair
description: "Restore/repair Lailaba skills in a Termux-bundled install. Diagnose a corrupt bundled-skills SOURCE tree (~/.hermes/hermes-agent/skills, a git repo), revert it via git checkout, and re-sync to the live ~/.lailaba/skills via the internal tools.skills_sync.sync_skills(). Trigger: 'restore my skills', 'my skills are broken', sync/restore requests, or skills not loading after an update."
version: 1.0.0
author: Lailaba AI
license: MIT
platforms: [linux, android, termux]
---

# Lailaba Skills Repair (Termux-bundled)

See `references/commands.md` for copy-paste recipes.

## When to use
- User says "restore my skills", "my skills are gone/broken", "re-sync skills", or you find skills not loading.
- Live skills in `~/.lailaba/skills/` look fine, but a previous `lailaba update` or a botched manual edit left the BUNDLED SOURCE tree corrupt. (This is the common real case — the live tree is usually innocent; the source git repo is what gets damaged.)

## Key topology (Termux bundle)
- Launcher: `~/bin/lailaba` (sh wrapper) → real binary `~/.hermes/hermes-agent/venv/bin/lailaba`
- Bundled skills SOURCE (a **git repo**): `~/.hermes/hermes-agent/skills/`
- Live/deployed skills: `~/.lailaba/skills/`
- Sync marker: `~/.lailaba/skills/.termux_bundled_sync_stamp` = `git:HEAD:<commit>`; startup re-syncs source→live when the git-revision fingerprint changes (`_termux_bundled_skills_sync_needed` in `lailaba_cli/main.py`).

## Diagnostic FIRST — do not assume corruption
1. `lailaba skills list` — if it shows "N enabled, 0 disabled, 0 ... errors", the LIVE tree is fine.
2. `git -C ~/.hermes/hermes-agent status --short skills/ | wc -l` — the source repo is the real source of truth. Large counts = corruption in source.
3. `diff -rq ~/.hermes/hermes-agent/skills/ ~/.lailaba/skills/` — see what actually diverges between source and live.
4. Inspect the *nature* of changes: `git diff skills | grep '^-'`. A large number of deletions where many are a `Hermes`→`Lailaba` text swap indicates a HALF-FINISHED REBRAND, not random corruption. Don't blindly revert renames — understand them first.

## Repair procedure
1. **BACK UP BOTH trees first** (fully reversible). See `references/commands.md` for the `tar` recipe. Never skip this — `git checkout`/`rm -rf` are unrecoverable otherwise.
2. Revert the bundled source to pristine committed state:
   `cd ~/.hermes/hermes-agent && git checkout -- skills/`
   Then remove any ORPHANED untracked rebrand artifacts left by a botched rename (e.g. a new `lailaba-agent/` dir where `hermes-agent/` was the committed name, or `_lailaba_home.py` where `_hermes_home.py` was restored). Verify with `git status --short skills/` — should be empty.
3. Force re-sync from source into live skills (startup sync is gated by the stamp; force it):
   ```
   cd ~/.hermes/hermes-agent
   LAILABA_TERMUX_FORCE_SKILLS_SYNC=1 ~/.hermes/hermes-agent/venv/bin/python - <<'PY'
   from tools.skills_sync import sync_skills
   print(sync_skills(quiet=False))
   PY
   ```
   Expect: `updated: ~67`, `cleaned: a few`, `user_modified: 0`, `total_bundled: 72`.

## Pitfalls
- `lailaba skills` has NO `sync` subcommand. Valid choices: `browse, search, install, inspect, list, check, update, audit, uninstall, reset, list-modified, diff, opt-out, opt-in, repair-official, publish, snapshot, tap, config`. Sync is an **internal function** `tools.skills_sync.sync_skills()` invoked on startup; force it with `LAILABA_TERMUX_FORCE_SKILLS_SYNC=1` as above.
- `lailaba skills reset <name>` replaces a SINGLE local skill with the bundled version (useful when sync kept your local copy).
- A botched rename (e.g. `hermes-agent` → `lailaba-agent`) shows as: old dir DELETED in git + new untracked dir present. `git checkout -- skills/` restores the OLD name; you must also delete the NEW untracked dir to fully clean.
- Never restore the `lailaba-agent` bundled skill blindly if the user has a local customized copy — `sync_skills` keeps the local one and prints a warning. Use `lailaba skills reset lailaba-agent` only when you specifically want the bundled one.
- The source tree is a GIT REPO — `git checkout -- skills/` is the clean restore. Don't hand-edit individual SKILL.md files.
- Distinguish "intentional rebrand in progress" from "corruption". If the user is mid-rebrand, restoring to HEAD undoes their work — confirm intent before reverting.

## Verification
- `git -C ~/.hermes/hermes-agent status --short skills/` → empty.
- Previously-deleted files (e.g. `.../hermes-agent/SKILL.md`, `.../google-workspace/scripts/_hermes_home.py`) now exist in BOTH source and live.
- `lailaba skills list` → all enabled, 0 disabled (exact count varies by version).
