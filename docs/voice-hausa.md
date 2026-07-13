# Hausa Voice — design notes

Lailaba replies in **Hausa** by default. Voice works end-to-end on Telegram:

- **TTS** — `gTTS(lang="ha")` (free, no API key). gTTS only emits MP3, but Telegram
  shows an MP3 as a **downloadable audio file**, not a voice bubble. To get a real
  **tap-to-play voice message** the audio must be **OGG/Opus** delivered via `sendVoice`.
  So `scripts/hausa_tts.py` renders MP3 with gTTS, then transcodes to Opus OGG with
  `ffmpeg` (`-c:a libopus -b:a 24k -application voip`). Config: `tts.providers.hausa`
  uses `output_format: ogg`.
- **STT** — Groq Whisper (`whisper-large-v3-turbo`). Auto-detects Hausa.
  Needs `GROQ_API_KEY` in `~/.lailaba/.env`.
- **Voice-only mode** — `~/.lailaba/gateway_voice_mode.json` maps
  `"telegram:<CHAT_ID>": "voice_only"`. When set:
  - A **voice note** inbound → agent replies with **voice only** (no readable text).
  - A **plain audio file** inbound → normal **text** reply (NOT voice). This distinction
    is enforced by checking `event.message_type == MessageType.VOICE` (voice note) vs
    `MessageType.AUDIO` (audio attachment) before suppressing text.
  - A **text** inbound → normal text reply.

## Gateway patch (applies to `gateway/platforms/base.py`)

Two changes vs stock:

1. `_voice_only_chats` set on the platform adapter, populated from the persisted
   `gateway_voice_mode.json` in `gateway/run.py` (`_sync_voice_mode_state_to_adapter`).
2. In the delivery block:
   - Auto-TTS gate fires for `event.message_type == VOICE` and generates OGG audio.
   - Text is suppressed only when `_inbound_is_voice_note = (event.message_type == VOICE)`
     AND voice audio was delivered (`_tts_audio_delivered` or `media_files` holds audio).
   - The "response dropped" guard counts `_tts_audio_delivered` as a successful delivery
     (otherwise a voice-only reply is falsely reported as dropped).

Without these, stock `voice_only` still sends a text caption alongside the audio, and an
OGG/Opus file is needed for a true voice bubble instead of an `.mp3` attachment.
