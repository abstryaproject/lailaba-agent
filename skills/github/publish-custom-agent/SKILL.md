---
name: publish-custom-agent
description: "Publish a customized agent fork (Hermes/Lailaba-style) so a third party installs all features/tools/skills/voice from a single command (curl|bash install.sh). Covers the shallow-clone force-push failure, pre-push secrets hygiene, and the Telegram OGG/Opus voice-bubble gotcha."
version: 1.0.0
author: Lailaba Agent
license: MIT
platforms: [linux, macos, android]
metadata:
  hermes:
    tags: [GitHub, Git, Repositories, Publishing, Installer, Secrets, Voice, Telegram]
    related_skills: [github-repo-management, github-auth]
---

# Publish a Customized Agent Fork (single-command install)

Goal: take a heavily-customized local agent repo (e.g. a Hermes/Lailaba fork with renamed
binaries, custom skills, a Hausa voice layer, themed UI) and push it to a PUBLIC
GitHub repo where anyone can install the whole thing with ONE line:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/install.sh | bash
```

This is the pattern the user reuses ("like lailaba-ai"). Treat it as a class of work,
not a one-off.

## When to use
- User says "pull update to my <agent>-agent repo", "make it installable from one command",
  "publish my custom <agent>", or references an existing `install.sh` + `curl|bash` repo.
- The repo is a fork with MANY changed files (thousands) and out-of-tree runtime files
  (e.g. `~/bin/*.py`, `~/.lailaba/config.yaml`) that must be brought INTO the repo.

## Pre-work inventory (do this before any git push)
1. Locate the local fork and its remote. `git remote -v`, `git log --oneline -3`,
   `git status --short | wc -l` to gauge size.
2. Find out-of-repo custom files (wrapper scripts in `~/bin`, runtime config in
   `~/.lailaba/`, memory in `~/.hermes/memories/`). These MUST be copied into the
   repo as committed files or `.example` templates, or the single-command install breaks.
3. Study the EXISTING `install.sh` of a sibling repo (e.g. `~/lailaba-ai/install.sh`)
   and mirror its shape — the user already likes that exact UX.
4. **Check whether the REPO CODE is actually out of sync before pushing.** Run
   `git fetch <user-remote>` (NOT the slow upstream `origin` — its clone/fetch can hang for
   minutes on flaky links; the user remote is all you need to compare against), then
   `git diff <local-branch> <user-remote>/<branch>`. If that diff is **empty**, the code is
   already published — do NOT force-push. The user's "pull update to my repo" most often
   means the **skills bundle** diverged, not the `app/` code (see next section).

## Skill-bundle divergence (the common "just sync my update" case)
For Hermes/Lailaba-style forks, the installer ships skills from the **repo's `skills/` dir**
(`install.sh` → `setup-<agent>.sh` does `cp -rn skills/* ~/.lailaba/skills/`). The live
runtime skills dir (`~/.lailaba/skills/`) is a SUPERSET: it carries new bundles plus
in-place edits the repo lacks. So "this update" usually lives in skills, not core code.
Detect and sync:
1. `diff -rq ~/.lailaba/skills <repo>/skills` — ignore these runtime dot-state files at the
   skills ROOT (they are NOT inside the per-skill subdirs, so `cp -r` of subdirs won't copy them):
   `.bundled_manifest`, `.curator_state`, `.hub`, `.termux_bundled_sync_stamp`,
   `.usage.json`, `.usage.json.lock`, and the `index-cache/` dir.
2. For each dir "Only in ~/.lailaba/skills", `cp -r` it into `<repo>/skills/`.
   For "Files differ", `rm -rf <repo>/skills/<path> && cp -r ~/.lailaba/skills/<path> <repo>/skills/`.
3. Re-run `git status --short` — new dirs show as `??`, edits as ` M`. Commit + push.
A reusable script lives at `references/sync-skills-to-repo.sh` (run with
`REPO=<repo> bash references/sync-skills-to-repo.sh`). See also the
`lailaba-agent` skill (bundled) for how skills re-sync on git-rev change.

## Build the repo contents
- `install.sh` — the curl|bash entrypoint. Self-detects if already inside the repo;
  if not, clones `https://github.com/<owner>/<repo>.git` into `$HOME/<repo>` then `cd`s
  in and runs the setup script. Safe: only touches the install dir + `~/.lailaba` + `~/bin`.
- `setup-<agent>.sh` — does the real work: detect Termux vs desktop, build a venv
  (pip on Termux, `uv` elsewhere), install deps, symlink the CLI, sync bundled skills,
  and for a voice layer: install `ffmpeg` + `gTTS`, copy `scripts/hausa_tts.py` →
  `~/bin/`, copy `config.yaml.example` + `gateway_voice_mode.json.example` → `~/.lailaba/`.
- `scripts/hausa_tts.py` — make it PATH-agnostic (use `shutil.which("ffmpeg")`,
  temp files), NOT hardcoded to the author's venv.
- `config.yaml.example`, `gateway_voice_mode.json.example` — blanked templates (chat-id /
  key slots empty). The installer copies them to the runtime dir; NEVER commit the live
  `~/.lailaba/config.yaml` (covered by `.gitignore` on the runtime dir).
- `README.md` + `docs/<feature>.md` — the one-line install command, configure steps,
  and design notes.

## Force-push over a shallow clone (THE common failure)
If the local repo is a **shallow clone** (`[ -f .git/shallow ]`; `git rev-list --count HEAD`
is small) and you `git push --force` history GitHub lacks, it FAILS:
```bash
remote: fatal: did not receive expected object d05cc8f4...
error: remote unpack failed: index-pack failed
! [remote rejected] main -> main (failed)
```
`git fetch --unshallow` often does NOT rescue this (the remote may itself be shallow).
**Fix — publish via an orphan branch with fresh history:**
```bash
git add -A                                  # respects .gitignore
git checkout --orphan clean-main            # NO parents -> no missing objects
git commit -m "Custom <project>: <features>"
git push --force <remote> clean-main:main
```
This also cleanly overwrites a stale "Initial commit" already on the remote (only when the
user explicitly approves overwriting remote history). After push you can restore the branch
name: `git branch -M main && git push -u <remote> main`.
PITFALL: an orphan commit drops upstream history — only do this for a force-overwrite scenario.

## Non-fast-forward: remote advanced via Dependabot / GitHub Actions (flaky-link gotcha)
When `git push` is rejected with "fetch first" but the remote is NOT your upstream, the
remote `main` often advanced via an automated push (Dependabot `dependabot/*` branches,
GitHub Actions bot). On a flaky link the local `origin/main` ref can stay STALE even after
`git fetch` "succeeds" (rc=0 but ref unchanged) — so `git log HEAD..origin/main` looks empty
and you can't tell you've diverged. Authoritative truth is `git ls-remote <remote>`:
1. `git ls-remote origin` -> read the `refs/heads/main` SHA (e.g. `4159bc4...`). Compare to
   your local `git rev-parse HEAD`. If they differ, the remote is ahead.
2. Fetch the SPECIFIC ref, not the whole remote (avoids the hang):
   `timeout 120 git fetch --force --depth 20 origin main`  (run in background if it stalls).
   If the ref still won't update, fetch the exact ref:
   `git fetch origin refs/heads/main:refs/remotes/origin/main`.
3. Decide:
   - If your local HEAD is an ancestor of the fetched `origin/main` -> rebase/merge, then push.
   - If truly diverged (different root) AND the user approves overwriting remote history ->
     use the orphan-branch force-push above. NEVER overwrite the remote's existing commit
     (it may carry Dependabot security fixes the user wants) without explicit approval.
PITFALL: a failed `git push` with "fetch first" is a HARD STOP — do not retry-push, do not
force-push blind. Resolve the divergence first (rebase preferred; orphan-push only with
explicit user go-ahead).

## Pre-push secrets hygiene (NON-NEGOTIABLE)
1. Confirm `.gitignore` excludes the secret sinks: `venv/`, `node_modules/`, `.env`,
   and the runtime config dir (e.g. `.lailaba/`). Test: `git check-ignore <path>`.
2. Scan for REAL key VALUES, not variable names. A naive `grep TELEGRAM_BOT_TOKEN`
   matches harmless code references. Use an exact-value regex against the staged tree:
   ```bash
   git diff --cached --name-only -z | xargs -0 grep -IlE \
     "TELEGRAM_BOT_TOKEN=[A-Za-z0-9_-]{20,}|GROQ_API_KEY=[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|BEGIN (RSA|OPENSSH) PRIVATE KEY" 2>/dev/null
   git grep -nE "TELEGRAM_BOT_TOKEN[:= ]+[A-Za-z0-9_-]{24,}|GROQ_API_KEY[:= ]+[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{32,}|BEGIN (RSA|OPENSSH) PRIVATE KEY" <branch> 2>/dev/null
   ```
   Filter out `example`/`placeholder`/`os.environ`/`getenv`/`config.get`/`self.`/`env[`
   and test fixtures (e.g. `tests/.../test_*.py` writing `b"-----BEGIN OPENSSH PRIVATE KEY-----"`).
   Only a literal `KEY=realvalue` line is a leak.
3. Publish blanked `.example` / `.json.example` templates; let the installer copy them to
   the runtime dir. Never commit live `~/.lailaba/config.yaml` or `gateway_voice_mode.json`.

## Voice-bubble gotcha (Telegram)
For a real tap-to-play **voice message** (NOT a downloadable `.mp3` file attachment), the
audio MUST be OGG/Opus delivered via `sendVoice`. gTTS only emits MP3, so transcode:
`ffmpeg -i in.mp3 -c:a libopus -b:a 24k -application voip out.ogg`.
Set the TTS provider `output_format: ogg` and point the command at a wrapper script that
does MP3→Opus. Without this, the bot sends an "audio file" the user must download — which
the user explicitly rejects ("direct voice not voice in file.mp3").

## Verify before declaring done
- `bash -n install.sh && bash -n setup-<agent>.sh` (syntax).
- `python -m py_compile scripts/hausa_tts.py`.
- `gh api repos/<owner>/<repo> --jq '.private'` → `false` (public).
- Each key file present on remote: `gh api repos/<owner>/<repo>/contents/<file> --jq '.path'`.
- Final tight secret scan across the ENTIRE committed tree returns nothing.
- Confirm the orphan push actually landed: `git ls-remote <remote>` shows your commit.
