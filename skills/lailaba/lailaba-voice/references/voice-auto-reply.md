# Voice Auto-Reply (reply in voice to voice notes)

Verified against the running Termux install, session 2026-07-13.

## What "reply in voice" actually requires
TTS config (`tts.provider`) only enables synthesis. To make the agent ANSWER a
voice note with a voice note, the chat must be opted into voice mode. This is a
separate, per-chat gateway setting.

## Persistence file
`~/.lailaba/gateway_voice_mode.json`

```json
{
  "telegram:7699500490": "voice_only"
}
```

- Platform value for Telegram is the literal string `telegram` (confirmed via
  `Platform.TELEGRAM.value == "telegram"` in `gateway/platforms/base.py`).
- The key format is `"<platform>:<chat_id>"`. Legacy unprefixed keys are SKIPPED
  on load with a warning — always prefix.

## Modes
| mode         | behavior                                                        |
|--------------|----------------------------------------------------------------|
| `off`        | never auto-TTS                                                  |
| `voice_only` | auto-TTS reply ONLY when inbound message is a VOICE note       |
| `all`        | auto-TTS every reply (text AND voice)                           |

For "reply in voice when I send voice" -> `voice_only`. Default intent.

## User-facing control (slash command, Telegram/Discord)
- `/voice on`    -> `voice_only`
- `/voice tts`   -> `all`
- `/voice off`   -> `off`
- `/voice status`-> show current mode
- bare `/voice`  -> toggles off <-> on

The handler (`gateway/slash_commands.py` `_handle_voice_command`) writes the
file AND pushes the adapter's `_auto_tts_enabled_chats`/`_auto_tts_disabled_chats`.

## Code-level trigger (why it only fires on voice)
`gateway/platforms/base.py` (~line 4684), inside the reply-send path:

```python
_tts_path = None
if (self._should_auto_tts_for_chat(event.source.chat_id)
        and event.message_type == MessageType.VOICE
        and text_content
        and not media_files):
    # synthesize via tools.tts_tool.text_to_speech_tool(...)
```

`_should_auto_tts_for_chat` (line ~2500) returns True when chat is in
`_auto_tts_enabled_chats` (explicit `/voice on|tts`) OR (global
`voice.auto_tts` is True AND chat not in `_auto_tts_disabled_chats`).

## Setting it from the CLI / agent (no Telegram message needed)
1. Write the JSON file directly (use `write_file`, which is allowed -- it is not
   the guard-railed config.yaml):
   ```json
   { "telegram:7699500490": "voice_only" }
   ```
2. RESTART the gateway so `_load_voice_modes()` + `_sync_voice_mode_state_to_adapter()`
   load it:
   ```bash
   tmux kill-session -t hermes-gateway-watch
   tmux new-session -d -s hermes-gateway-watch "lailaba gateway run 2>&1 | tee -a ~/.lailaba/logs/gateway.log"
   ```
3. Verify: the JSON now reads back the mode; gateway log shows no voice-mode
   warnings on load. (No Telegram error = success.)

## Gotchas
- `voice_only` != `all`. Use `voice_only` unless the user explicitly wants every
  reply spoken. `all` converts text replies to voice notes too.
- Editing the JSON does NOT take effect until gateway restart -- the mode is only
  synced to the live adapter on (re)connect.
- This is independent of the STT key. STT (Groq Whisper) transcribes the inbound
  voice; voice mode controls the OUTBOUND reply. Both can be on independently.

## CRITICAL USER RULE: voice-only applies to VOICE NOTES, not audio files
The user explicitly required: "reply voice message only on voice chat, not audio."
This maps to the gateway's `MessageType` enum in `gateway/platforms/base.py`:
- `MessageType.VOICE` ("voice")  -> a Telegram **voice note** (round mic button).
- `MessageType.AUDIO` ("audio")  -> a **plain audio file attachment** (mp3 sent as
  a file, not a voice note).

The two are DIFFERENT inbound types. A naive `voice_only` implementation that only
checks the `_voice_only_chats` set will wrongly suppress text on BOTH. The correct
gate must require the **inbound** message to be a voice note:
```python
_inbound_is_voice_note = (event.message_type == MessageType.VOICE)
# ... suppress text ONLY when: _voice_only AND _inbound_is_voice_note AND audio delivered
```
A plain audio file attachment must keep getting a normal TEXT reply.

## True voice-only (no text leak) requires a CODE PATCH
**Stock `voice_only` mode is NOT actually voice-only**: it sends the voice audio
AND a text caption (and, if the caption path is skipped, a separate text message).
There is no config flag to suppress the readable text. To make the reply
**voice-only with no transcript leak**, patch the reply-send block in
`gateway/platforms/base.py` (the same block that holds the auto-TTS gate, ~line 4762
"# Send the text portion").

### Why the obvious fix fails (root cause learned the hard way)
You might guard the text send with `not (_voice_only and _tts_path and exists)`.
That does NOT work, because:
1. The auto-TTS block (`if _should_auto_tts_for_chat(...) and message_type==VOICE
   and text_content and not media_files`) often does NOT execute — when the agent
   itself calls the TTS tool, its reply contains a `MEDIA:` tag, which
   `extract_media(response)` turns into `media_files=[('/.../tts_<ts>.mp3', False)]`.
   Now `media_files` is NON-EMPTY, so the auto-TTS gate's `not media_files` is False
   and the block is skipped. Yet the TTS mp3 IS in `media_files` and gets delivered
   later via the generic media loop (`send_voice`).
2. The `_tts_path` file is `os.remove`d in the play_tts `finally` block BEFORE the
   text-send guard runs, so any `Path(_tts_path).exists()` check is always False.

So the reliable gate checks the delivered media, not the auto-TTS block:
```python
_inbound_is_voice_note = (event.message_type == MessageType.VOICE)
_media_has_audio = any(
    Path(p).suffix.lower() in {".mp3", ".ogg", ".opus", ".wav", ".m4a", ".flac"}
    for p, _is_v in (media_files or [])
)
_suppress_text = bool(
    _voice_only
    and _inbound_is_voice_note
    and (_tts_audio_delivered or _media_has_audio)
)
if text_content and not _tts_caption_delivered and not _suppress_text:
    # ...send text...
```
(`_tts_audio_delivered` is the flag set by the separate auto-TTS play_tts path;
`_media_has_audio` covers the agent-emitted MEDIA tag case. Either is sufficient,
but BOTH must be ANDed with `_inbound_is_voice_note` so audio files don't trigger it.)

### Verification recipe (real, not assumed)
Send a voice note via Bot API and confirm the log shows NO `Sending response`
text line; then send a plain audio file and confirm `Sending response (N chars)`
DOES appear:
```bash
TOKEN=$(grep -oE TELEGRAM_BOT_TOKEN=.* ~/.lailaba/.env | sed 's/TELEGRAM_BOT_TOKEN=//')
CHAT=7699500490
# voice note (correct: no text reply)
~/.hermes/hermes-agent/venv/bin/python -c "from gtts import gTTS; gTTS(text='Murya kawai',lang='ha').save('$HOME/v.ogg')"
curl -F chat_id=$CHAT -F voice=@$HOME/v.ogg https://api.telegram.org/bot$TOKEN/sendVoice
# audio file (correct: text reply sent)
~/.hermes/hermes-agent/venv/bin/python -c "from gtts import gTTS; gTTS(text='Audio fayil',lang='ha').save('$HOME/a.mp3')"
curl -F chat_id=$CHAT -F audio=@$HOME/a.mp3 https://api.telegram.org/bot$TOKEN/sendAudio
# then: grep 'Sending response' ~/.lailaba/logs/gateway.log  -> only the audio one
```

### Restart gotcha (Termux)
`pkill -9 -f "[l]ailaba gateway"` and `pgrep -f "lailaba gateway run"` can MATCH THE
AGENT'S OWN SHELL (the command string contains the pattern) and kill it (exit -9),
leaving the gateway alive. Safe kill: find the venv bin path, exclude the current
shell PID, or use the tmux wrapper PID:
```bash
MYSELF=$$; for p in $(pgrep -f "lailaba gateway run"); do [ "$p" != "$MYSELF" ] && kill -9 "$p"; done
tmux kill-session -t hermes-gateway-watch
rm -f ~/.lailaba/gateway.lock ~/.lailaba/gateway.pid
tmux new-session -d -s hermes-gateway-watch "lailaba gateway run 2>&1 | tee -a ~/.lailaba/logs/gateway.log"
```
