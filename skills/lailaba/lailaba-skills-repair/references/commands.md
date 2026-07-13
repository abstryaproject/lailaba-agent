# Copy-paste command recipes — Lailaba skills repair

## Backup both trees (run first, always)
TS=$(date +%Y%m%d_%H%M%S); BK=~/skills_restore_backup_$TS; mkdir -p "$BK"
tar czf "$BK/deployed.tar.gz" -C ~ .lailaba/skills
tar czf "$BK/bundled_source.tar.gz" -C ~ .hermes/hermes-agent/skills

## Diagnose
lailaba skills list
git -C ~/.hermes/hermes-agent status --short skills/ | wc -l
diff -rq ~/.hermes/hermes-agent/skills/ ~/.lailaba/skills/
# Inspect nature of changes (rebrand vs corruption)
git -C ~/.hermes/hermes-agent diff skills | grep '^-' | grep -iv '^---' | grep -ic 'hermes\|lailaba'
git -C ~/.hermes/hermes-agent diff skills | grep '^-' | grep -iv '^---' | wc -l
# See rename pairs in source
git -C ~/.hermes/hermes-agent ls-files skills/autonomous-ai-agents/ | grep -E 'lailaba-agent|hermes-agent'

## Revert source to pristine HEAD + clean orphans
cd ~/.hermes/hermes-agent
git checkout -- skills/
# Remove orphaned rebrand artifacts if present (originals restored by checkout):
rm -rf skills/autonomous-ai-agents/lailaba-agent
rm -f skills/productivity/google-workspace/scripts/_lailaba_home.py
git status --short skills/   # expect empty

## Force re-sync source -> live
cd ~/.hermes/hermes-agent
LAILABA_TERMUX_FORCE_SKILLS_SYNC=1 ~/.hermes/hermes-agent/venv/bin/python - <<'PY'
from tools.skills_sync import sync_skills
print(sync_skills(quiet=False))
PY

## Replace a single local skill with the bundled version
lailaba skills reset <name>
