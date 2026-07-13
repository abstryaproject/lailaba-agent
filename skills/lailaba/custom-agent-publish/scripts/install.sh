#!/usr/bin/env bash
# lailaba-agent installer
#
# Lays the custom agent layer (skills, skins, scripts, memories, config example)
# into an existing Lailaba install at ~/.lailaba (honours $LAILABA_HOME).
#
# Safe: only writes inside the Lailaba home. Never touches .env / API keys.
# Idempotent: skips files that already exist unless --force is passed.
set -euo pipefail

FORCE=0
for a in "$@"; do case "$a" in --force|-f) FORCE=1;; esac; done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAILABA_HOME="${LAILABA_HOME:-$HOME/.lailaba}"
mkdir -p "$LAILABA_HOME"

echo "=== lailaba-agent installer ==="
echo "[*] Target: $LAILABA_HOME"

cp_tree() {
  [ -d "$1" ] || return 0
  mkdir -p "$2"
  ( cd "$1" && find . -type f ) | while read -r f; do
    dstd="$2/$(dirname "$f")"; dstf="$2/$f"
    if [ -e "$dstf" ] && [ "$FORCE" -eq 0 ]; then echo "  skip (exists): $f"
    else mkdir -p "$dstd"; cp "$1/$f" "$dstf"; echo "  install: $f"; fi
  done
}

echo "[*] Installing skills -> $LAILABA_HOME/skills"
cp_tree "$HERE/skills" "$LAILABA_HOME/skills"

echo "[*] Installing skins -> $LAILABA_HOME/skins"
mkdir -p "$LAILABA_HOME/skins"
for f in "$HERE"/skins/*; do
  [ -f "$f" ] || continue; b="$(basename "$f")"
  if [ -e "$LAILABA_HOME/skins/$b" ] && [ "$FORCE" -eq 0 ]; then echo "  skip (exists): skins/$b"
  else cp "$f" "$LAILABA_HOME/skins/$b"; echo "  install: skins/$b"; fi
done

echo "[*] Installing scripts -> $LAILABA_HOME/scripts"
mkdir -p "$LAILABA_HOME/scripts"
for f in "$HERE"/scripts/*; do
  [ -f "$f" ] || continue; b="$(basename "$f")"
  if [ -e "$LAILABA_HOME/scripts/$b" ] && [ "$FORCE" -eq 0 ]; then echo "  skip (exists): scripts/$b"
  else cp "$f" "$LAILABA_HOME/scripts/$b"; chmod +x "$LAILABA_HOME/scripts/$b" 2>/dev/null || true; echo "  install: scripts/$b"; fi
done

echo "[*] Installing memories (if absent) -> $LAILABA_HOME/memories"
mkdir -p "$LAILABA_HOME/memories"
for f in "$HERE"/memories/*; do
  [ -f "$f" ] || continue; b="$(basename "$f")"
  if [ -e "$LAILABA_HOME/memories/$b" ]; then echo "  skip (exists): memories/$b"
  else cp "$f" "$LAILABA_HOME/memories/$b"; echo "  install: memories/$b"; fi
done

if [ -e "$LAILABA_HOME/config.yaml" ]; then
  echo "[*] $LAILABA_HOME/config.yaml already exists — NOT overwritten."
  echo "    Merge these reference values from config.yaml.example if desired:"
  grep -E "skin:|theme:|default:|provider:|base_url:" "$HERE/config.yaml.example" 2>/dev/null | sed 's/^/    - /'
else
  echo "[*] No config.yaml found; config.yaml.example is reference only. Real config via 'lailaba setup'."
fi

echo
echo "=== Done ==="
echo "  Lailaba home : $LAILABA_HOME"
echo "  Skills       : $(find "$LAILABA_HOME/skills" -name SKILL.md 2>/dev/null | wc -l) SKILL.md present"
echo "  Run 'lailaba skills' to verify, then 'lailaba chat'."
echo
echo "  To apply the hackers skin + cyberpunk dashboard:"
echo "    lailaba config set display.skin hackers"
echo "    lailaba config set dashboard.theme cyberpunk"
