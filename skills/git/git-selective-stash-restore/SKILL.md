---
name: git-selective-stash-restore
description: Restore a feature that was removed from the working tree but preserved in git stash, WITHOUT clobbering other uncommitted changes. Use when a feature was "removed" but its files were stashed (not deleted from history), and a full `git stash pop` aborts because the working tree has diverged.
---

# Selective git-stash restore (tree-safe)

A feature was removed from the working tree, but its files were saved in
`git stash` (not truly deleted). You must bring it back WITHOUT clobbering other
uncommitted edits (theming, admin, PWA, etc.) that now touch the same files.

## Why `git stash pop` fails here
`git stash pop` requires the stash to apply cleanly on top of the current working
tree. If the tree has diverged (other edits to the same files the stash touches,
e.g. `app/main.py`, `app/core/database.py`), it **aborts** and keeps the stash:
```
Please commit your changes or stash them before you merge. Aborting.
```
So `git stash pop` is the WRONG tool when the tree has other work in flight.

## Procedure (surgical, preserves other edits)
1. **Restore the standalone files only** — paths the stash added/changed that do
   NOT conflict with current edits:
   ```bash
   git checkout <stash> -- path/to/file1 path/to/dir/  # leaves everything else intact
   ```
   This re-creates the removed files (the sandbox, frontend, route, etc.).
2. **Hand-re-wire the conflicting core files.** For each file the stash changed
   AND the tree also changed, extract the stash's additions and apply them by
   hand with the `patch` tool (exact old/new strings — never retype):
   - Get the diff: `git diff HEAD <stash> -- file > /some/patch` (use `~/.local/tmp`,
     NOT `/tmp` — `/tmp` is read-only on Termux). `git apply --check patch` — if it
     applies clean, run it; if it conflicts, hand-apply only the needed hunks.
   - Extract an exact code block from the stash WITHOUT retyping (homoglyph trap —
     never hand-type near-identical identifiers like `serve_forever`, `alg=none`,
     base64, hex colors):
     ```bash
     git show <stash>:app/core/database.py | awk '/^class LabProgress/,/^# Indexes for performance/'
     ```
     Paste that exact output into the current file via `patch`.
3. **Restart + verify** the affected service (no `--reload`, so restart the
   process). Confirm the feature actually serves, not just that files exist.

## Pitfalls
- **`/tmp` is read-only on Termux** — write temp/patch files to `~/.local/tmp`.
- **Never hand-retype near-identical code** (ORM class names, `serve_forever`,
  `alg=none`, base64, hex). Copy the exact bytes from `git show`/`awk` into the
  patch. A single mis-transcribed character crashes import silently (NameError →
  process exits, `ps` shows no process).
- **A removed feature usually also dropped its ROUTE REGISTRATION and MOUNTS,**
  not just the files. After restoring `lab.py`, also re-add
  `app.include_router(lab.router)`, any `app.mount("/lab", ...)`, and the route
  import. Source files existing ≠ the feature being reachable.
- **New DB tables** referenced by a restored route (e.g. `LabProgress`,
  `LabReward`) must be re-added to the model; `init_db()` auto-creates them on
  restart. Missing class → `ImportError` in the route → 500 on every call.
- **Phantom exit banners:** after you `pkill` an old server, its buffered
  "Application startup complete" / exit-log can flush LATER as a fake "process
  exited" notification. Verify with `ps -p <pid>` + a live `curl`, not the banner.

## Worked example
The self-hosted Lailaba Lab was removed this session and saved in
`stash@{0}` (`pre-restore-20260713-105227`). Restored 2026-07-14:
`git checkout stash@{0} -- lab/ app/api/routes/lab.py app/static/{css,js}/lab.*
app/templates/lab.html app/services/ai_service.py`, then hand-re-added
`LabProgress`+`LabReward` to `database.py`, `LAB_ARENA_REALTIME` to `config.py`,
and the router import + `include_router(lab.router)` + `/lab` StaticFiles mount +
rate-limiter exemption to `main.py`. (Note: `lailaba-lab-training-rooms` is a
protected/bundled skill and could not be patched with this recipe — hence this
general skill carries it.)
