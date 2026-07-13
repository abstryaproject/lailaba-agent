#!/usr/bin/env python3
"""
Hausa TTS wrapper for the Lailaba command-type TTS provider.

Reads UTF-8 text from argv[1] and writes speech to argv[2].

gTTS only emits MP3, but for a TRUE Telegram *voice bubble* (a direct
voice message you tap to play, not a downloadable .mp3 file) the Bot API
requires OGG/Opus. We therefore render MP3 via gTTS into a temp file and
transcode it to Opus OGG with ffmpeg, writing the result to argv[2].

Usage (wired in config.yaml -> tts.providers.hausa.command):
    hausa_tts.py {input_path} {output_path}
"""
import os
import sys
import tempfile

try:
    from gtts import gTTS
except ImportError:
    sys.stderr.write("gTTS not installed\n")
    sys.exit(2)


def _have_ffmpeg() -> bool:
    from shutil import which
    return which("ffmpeg") is not None


def main() -> int:
    if len(sys.argv) < 3:
        sys.stderr.write("usage: hausa_tts.py <input_text_path> <output_audio_path>\n")
        return 2

    in_path = sys.argv[1]
    out_path = sys.argv[2]

    with open(in_path, "r", encoding="utf-8") as fh:
        text = fh.read().strip()
    if not text:
        sys.stderr.write("empty text\n")
        return 1

    # Render to MP3 first (gTTS only does mp3).
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        mp3_path = tmp.name
    try:
        gTTS(text=text, lang="ha", slow=False).save(mp3_path)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"gTTS failed: {exc}\n")
        return 1

    # Transcode MP3 -> Opus OGG so Telegram delivers a *voice bubble*.
    out_dir = os.path.dirname(os.path.abspath(out_path))
    os.makedirs(out_dir, exist_ok=True)
    if _have_ffmpeg():
        import subprocess
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", mp3_path,
                    "-c:a", "libopus", "-b:a", "24k",
                    "-application", "voip",
                    out_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return 0
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"ffmpeg transcode failed ({exc}); falling back to mp3\n")

    # Fallback: deliver the MP3 (Telegram will show it as an audio *file*,
    # not a voice bubble) so the user at least gets a reply.
    try:
        os.replace(mp3_path, out_path)
        return 0
    except OSError:
        try:
            import shutil
            shutil.copyfile(mp3_path, out_path)
            return 0
        except Exception:  # noqa: BLE001
            return 1
    finally:
        if os.path.exists(mp3_path):
            try:
                os.remove(mp3_path)
            except OSError:
                pass


if __name__ == "__main__":
    sys.exit(main())
