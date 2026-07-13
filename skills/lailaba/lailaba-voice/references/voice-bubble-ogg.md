# Voice bubble (OGG/Opus) delivery recipe — Lailaba Hausa TTS

User hard rule: "direct voice not voice in file.mp3" — a Telegram voice NOTE
(playable bubble), not a downloadable audio FILE.

## Why .mp3 is always a file
- gTTS emits only MP3.
- Telegram adapter `send_voice` (`plugins/platforms/telegram/adapter.py`)
  routes by extension:
  - `ext in {".ogg", ".opus"}` → `sendVoice` (voice bubble)
  - `ext in {".mp3", ".m4a"}` → `sendAudio` (file attachment)
- So an `.mp3` reply is ALWAYS a file, never a bubble.

## Fix
1. Wrapper `~/bin/hausa_tts.py`: gTTS → mp3, then ffmpeg mp3→Opus ogg:
   ```python
   from gtts import gTTS
   import subprocess, sys
   text_path, out_path = sys.argv[1], sys.argv[2]
   mp3 = out_path + '.mp3'
   gTTS(text=open(text_path, encoding='utf-8').read(), lang='ha').save(mp3)
   ogg = out_path
   subprocess.run(['ffmpeg','-y','-i',mp3,'-c:a','libopus',
                   '-b:a','24k','-application','voip',ogg], check=True)
   ```
2. Config: `lailaba config set tts.providers.hausa.output_format ogg`
   (TTS tool derives the output path extension from `output_format`).
3. Restart gateway.

## Verify the bubble (don't trust the log)
```python
import requests
TOKEN='...'; CHAT=7699500490
with open('test.ogg','rb') as f:
    r=requests.post(f'https://api.telegram.org/bot{TOKEN}/sendVoice',
        data={'chat_id':CHAT},
        files={'voice':('a.ogg',f,'audio/ogg')}).json()
res=r.get('result',{})
print('type:', 'voice' if 'voice' in res else ('audio' if 'audio' in res else 'unknown'))
```
`type: voice` → correct bubble. `audio` → still a file (fix extension/config).

## base.py bugs hit while wiring this (see SKILL.md Pitfalls)
- FALSE `response_delivery_dropped`: add `or _tts_audio_delivered` to
  `_anything_delivered` (~line 4916) in `gateway/platforms/base.py`.
- `UnboundLocalError: '_voice_only'`: compute the flag inline via getattr,
  never reference `_voice_only` before the play_tts block assigns it.
