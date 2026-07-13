# Lailaba Agent (custom Hermes)

Custom **Lailaba AI** layer built on top of the upstream [Hermes agent](https://github.com/NousResearch/hermes-agent) — bundled with Hausa voice (TTS + STT), the "hackers/cyberpunk" skin, custom skills, memory directives, and a single-command installer.

## Features

- Full Lailaba / Hermes agent (chat, tools, cron, skills, gateway)
- **Hausa voice**, end-to-end:
  - **TTS** → gTTS (free, no API key) transcoded to OGG/Opus so Telegram delivers a real **voice bubble** (tap-to-play), not a `.mp3` file
  - **STT** → Groq Whisper (auto-detects Hausa)
  - **Voice-only mode**: a chat can be set so it replies with **voice only** (no readable text) — and it triggers only on **voice notes**, not plain audio files
- Cyberpunk/matrix theme applied to dashboard + Live Range UI
- Bundled skills, memory (reply in Hausa by default), and config templates

## Quick install (one command)

```bash
curl -fsSL https://raw.githubusercontent.com/abstryaproject/lailaba-agent/main/install.sh | bash
```

Or on Termux / Android:

```bash
pkg install -y git curl && curl -fsSL https://raw.githubusercontent.com/abstryaproject/lailaba-agent/main/install.sh | bash
```

Or clone + run:

```bash
git clone https://github.com/abstryaproject/lailaba-agent.git
cd lailaba-agent && ./install.sh
```

The installer will:

1. Clone the repo (if run standalone) and `cd` into it
2. Create a Python venv and install the Lailaba bundle (Termux-tested on Android)
3. Install **ffmpeg** + **gTTS** for Hausa voice
4. Copy `scripts/hausa_tts.py` → `~/bin/` and config templates → `~/.lailaba/`
5. Symlink the `lailaba` CLI and sync bundled skills

## Configure

```bash
lailaba setup          # add your API keys (OpenRouter, Groq, Telegram bot token)
```

Keys go in `~/.lailaba/.env` (never committed). The example config is at
`config.yaml.example` → copied to `~/.lailaba/config.yaml`.

## Run

```bash
lailaba                 # chat in the terminal
lailaba gateway        # run the Telegram / voice gateway (foreground, Termux)
lailaba gateway install # install gateway as a service (systemd on Linux)
```

## Enable Hausa voice-only for a Telegram chat

Set the chat id in the voice-mode file (replace `<CHAT_ID>` with your Telegram chat id):

```bash
echo '{"telegram:<CHAT_ID>": "voice_only"}' > ~/.lailaba/gateway_voice_mode.json
```

Then restart the gateway. That chat will now get **voice replies only** — and only when you send a **voice note** (a plain audio file still gets a normal text reply).

See `docs/voice-hausa.md` for the full design (why OGG/Opus, the voice-note-vs-audio distinction, and the gateway patch notes).

## Layout

```
install.sh              # curl|bash single-command installer
setup-lailaba.sh       # venv + deps + Hausa voice layer
scripts/hausa_tts.py   # gTTS(Hausa) -> OGG/Opus voice bubble
config.yaml.example     # tts (hausa) + stt (groq) templates
gateway_voice_mode.json.example
skills/                # bundled custom skills
skins/                 # cyberpunk/hackers theme
memories/              # memory directives (reply in Hausa)
docs/voice-hausa.md   # voice design notes
```

## License

Upstream Hermes is MIT. This custom layer inherits that; see upstream for details.
