#!/usr/bin/env bash
# sync-skills-to-repo.sh — bring the repo's skills/ dir up to date with the
# live runtime skills (~/.lailaba/skills), excluding runtime dot-state files.
#
# Usage:
#   REPO=~/.hermes/hermes-agent bash references/sync-skills-to-repo.sh
# (REPO defaults to the cwd if it has a skills/ subdir.)
set -euo pipefail

REPO="${REPO:-$(pwd)}"
LIVE="${LAILABA_SKILLS_DIR:-$HOME/.lailaba/skills}"
SRC="$REPO/skills"

if [ ! -d "$SRC" ]; then
  echo "ERROR: $SRC not found — set REPO to the agent repo root." >&2
  exit 1
fi

# Runtime dot-state files at the skills ROOT (never inside per-skill subdirs).
# `cp -r` of subdirs won't touch these, but defensive-exclude anyway.
EXCLUDE='(\.bundled_manifest|\.curator_state|\.hub|\.termux_bundled_sync_stamp|\.usage\.json|\.usage\.json\.lock|index-cache)'

echo "[*] Diffing live ($LIVE) vs repo ($SRC) ..."
DIFF="$(diff -rq "$LIVE" "$SRC" 2>/dev/null || true)"

# 1) Whole dirs present only in live -> copy into repo
echo "$DIFF" | grep -E "^Only in $LIVE" | while IFS= read -r line; do
  rel="${line#Only in $LIVE/: }"
  rel="${rel%%: *}"
  if echo "$rel" | grep -qE "$EXCLUDE"; then
    echo "  skip dot-state: $rel"
    continue
  fi
  echo "  + copy dir: $rel"
  mkdir -p "$SRC/$(dirname "$rel")"
  cp -r "$LIVE/$rel" "$SRC/$(dirname "$rel")/"
done

# 2) Files that differ -> replace whole path in repo
echo "$DIFF" | grep -E "^Files .* and .* differ\$" | while IFS= read -r line; do
  f="${line#Files $LIVE/}"
  f="${f%% and $SRC/* differ}"
  if echo "$f" | grep -qE "$EXCLUDE"; then
    echo "  skip dot-state: $f"
    continue
  fi
  echo "  ~ replace: $f"
  rm -rf "$SRC/$f"
  mkdir -p "$(dirname "$SRC/$f")"
  cp -r "$LIVE/$f" "$SRC/$f"
done

echo "[*] Done. Repo skills/ now mirrors live (minus dot-state)."
echo "[*] Next: cd $REPO && git add skills/ && git status --short"
