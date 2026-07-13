# Publishing a customized agent fork — worked recipe

Exact pattern used to publish `abstryaproject/lailaba-agent` (a Hermes fork with
Hausa voice, hackers skin, bundled skills) so a third party installs everything
with one command.

## The advertised command
```bash
curl -fsSL https://raw.githubusercontent.com/abstryaproject/lailaba-agent/main/install.sh | bash
# Termux/Android prefix:
pkg install -y git curl && curl -fsSL https://raw.githubusercontent.com/abstryaproject/lailaba-agent/main/install.sh | bash
```

## Files at repo root
- `install.sh` — curl|bash entrypoint (mirrors lailaba-ai/install.sh). Self-detects
  if already inside the repo; else clones into `$HOME/lailaba-agent` and runs setup.
- `setup-lailaba.sh` — Termux-aware venv (pip) / desktop (uv), deps, CLI symlink,
  skills sync, + Hausa voice layer (ffmpeg, gTTS, hausa_tts.py → ~/bin/, config
  templates → ~/.lailaba/).
- `scripts/hausa_tts.py` — gTTS(lang="ha") → MP3 → ffmpeg transcode to Opus OGG.
  PATH-agnostic (uses `shutil.which("ffmpeg")`, temp files), not hardcoded to one venv.
- `config.yaml.example` — `tts:` (hausa, output_format: ogg) + `stt:` (groq) templates.
- `gateway_voice_mode.json.example` — `{"telegram:<CHAT_ID>": "voice_only"}` blanked.
- `README.md`, `docs/voice-hausa.md` — instructions + design notes.

## The shallow-clone force-push failure (and fix)
Local repo was a shallow clone (`[ -f .git/shallow ]`, `git rev-list --count HEAD` = 5).
`git push --force lailaba-agent main` failed:
```
remote: fatal: did not receive expected object d05cc8f4...
error: remote unpack failed: index-pack failed
! [remote rejected] main -> main (failed)
```
`git fetch --unshallow` did NOT clear the shallow state. Fix — orphan branch:
```bash
git add -A
git checkout --orphan lailaba-clean
git commit -m "Custom Lailaba (Hermes fork): Hausa voice, hackers skin, skills, install"
git push --force lailaba-agent lailaba-clean:main   # landed as 52e9edc
```
Result: remote `main` = fresh 1-commit history, 5745 files, repo public.

## Pre-push secrets hygiene (what actually ran)
1. `.gitignore` already covered `venv/`, `node_modules/`, `.env`, `.lailaba/` (runtime).
   Verified: `git check-ignore ~/.lailaba/config.yaml` → covered.
2. Tight value scan (NOT variable-name scan):
   ```bash
   git grep -nE "TELEGRAM_BOT_TOKEN[:= ]+[A-Za-z0-9_-]{24,}|GROQ_API_KEY[:= ]+[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{32,}|BEGIN (RSA|OPENSSH) PRIVATE KEY" lailaba-agent/main
   ```
   Matches found were all safe: `agent/redact.py` comment, and `tests/...` fixtures
   writing `b"-----BEGIN OPENSSH PRIVATE KEY-----"` / `api_key = "sk-abc...7890"` (fake).
   No literal `KEY=realvalue` lines → clean.
3. Published `.example` templates only; live `~/.lailaba/config.yaml` and
   `gateway_voice_mode.json` stayed local (gitignored).

## Voice-bubble gotcha
Telegram delivers an `.mp3` as a downloadable **audio file**, not a voice bubble.
For a real tap-to-play voice message the file must be OGG/Opus via `sendVoice`.
`scripts/hausa_tts.py` renders MP3 with gTTS then:
`ffmpeg -y -i in.mp3 -c:a libopus -b:a 24k -application voip out.ogg`.
Config: `tts.providers.hausa.output_format: ogg`.
