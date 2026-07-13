#!/usr/bin/env bash
# Lailaba AI (custom Hermes) — single-command installer
#
# Two ways to use:
#   1) One command (recommended):
#        curl -fsSL https://raw.githubusercontent.com/abstryaproject/lailaba-agent/main/install.sh | bash
#      or (Termux / Android):
#        pkg install -y git curl && curl -fsSL https://raw.githubusercontent.com/abstryaproject/lailaba-agent/main/install.sh | bash
#   2) Clone + run:
#        git clone https://github.com/abstryaproject/lailaba-agent.git
#        cd lailaba-agent && ./install.sh
#
# What it does:
#   - clones the repo (if run standalone) and cds into it
#   - runs setup-lailaba.sh which:
#       * creates a Python venv + installs Lailaba (+ Termux-tested bundle)
#       * installs ffmpeg + gTTS for Hausa voice
#       * copies hausa_tts.py -> ~/bin/ and config templates -> ~/.lailaba/
#       * symlinks the `lailaba` CLI
#       * syncs bundled skills
#   - after install: `lailaba setup` to add API keys, then `lailaba` to chat
#     or `lailaba gateway` to run the Telegram/voice gateway.
#
# Safe: only touches files inside the install directory + ~/.lailaba + ~/bin.
set -euo pipefail

REPO="abstryaproject/lailaba-agent"
INSTALL_DIR="${LAILABA_INSTALL_DIR:-$HOME/lailaba-agent}"

echo "=== Lailaba AI (custom Hermes) installer ==="

# --- If not already inside the repo, clone it ---
if [ ! -f "$(pwd)/setup-lailaba.sh" ]; then
  if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo "[*] Cloning $REPO into $INSTALL_DIR"
    if command -v git >/dev/null 2>&1; then
      git clone "https://github.com/${REPO}.git" "$INSTALL_DIR"
    else
      echo "ERROR: git is required to clone. Install git and retry." >&2
      exit 1
    fi
  fi
  cd "$INSTALL_DIR"
else
  INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$INSTALL_DIR"
fi

echo "[*] Working in: $INSTALL_DIR"

# Ensure setup script is executable and run it
chmod +x "$INSTALL_DIR/setup-lailaba.sh" 2>/dev/null || true
"$INSTALL_DIR/setup-lailaba.sh"
