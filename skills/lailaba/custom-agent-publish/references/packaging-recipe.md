# Custom Agent Packaging — full recipe (verified in session)

Goal: turn `~/.lailaba` (the user's custom agent layer) into a private GitHub repo
`abstryaproject/lailaba-agent` with an `install.sh`, installable on any other
Lailaba host via `git clone` + `./install.sh`.

## 1. Inventory (read-only)
```bash
du -sh ~/.lailaba
du -sh ~/.lailaba/* | sort -rh | head
# biggest offenders: lsp/ (~43M), state.db (~15M), sessions/, logs/ — EXCLUDE

# Custom skills = categories NOT in upstream source tree
cd ~/.lailaba && find skills -maxdepth 1 -mindepth 1 -type d | sed 's#.*/skills/##' | sort > "$HOME/deployed.txt"
cd ~/.hermes/hermes-agent && find skills -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sed 's#.*/skills/##' | sort > "$HOME/upstream.txt"
echo "Custom-only skills:"; comm -23 "$HOME/deployed.txt" "$HOME/upstream.txt"
# -> customization  devops  lailaba  self-hosted  .hub
```

## 2. Secret scan (MANDATORY before git add)
```bash
cd ~/.lailaba
grep -rIlE "sk-or-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|glpat-|hf_[A-Za-z0-9]{20,}|-----BEGIN (RSA|EC|OPENSSH|AES) PRIVATE KEY-----" \
  skills/ skins/ scripts/ memories/ config.yaml 2>/dev/null
# Empty output = clean. Abort if any real secret found.
```

## 3. Stage the portable layer (NOT in ~/.lailaba itself)
```bash
BUILD="$HOME/build/lailaba-agent"
rm -rf "$BUILD"; mkdir -p "$BUILD"/{skills,skins,scripts,memories}
cd ~/.lailaba
for s in customization devops lailaba self-hosted; do [ -d "skills/$s" ] && cp -r "skills/$s" "$BUILD/skills/$s"; done
cp skins/hackers.yaml "$BUILD/skins/" 2>/dev/null
cp scripts/ipwatchdog.sh "$BUILD/scripts/" 2>/dev/null
cp memories/MEMORY.md memories/USER.md "$BUILD/memories/" 2>/dev/null
cp config.yaml "$BUILD/config.yaml.example"   # ship as EXAMPLE, never the real file
# write README.md (templates/README.md), install.sh (scripts/install.sh), .gitignore
```

## 4. .gitignore (mandatory)
```
state.db  state.db-*  *.db  *.db-wal  *.db-shm
lsp/  logs/  sessions/  audio_cache/  image_cache/  cache/  cron/output/
.env  .env.*  config.yaml  memories/*.lock  __pycache__/  .DS_Store
```

## 5. Test installer BEFORE pushing
```bash
export LAILABA_HOME="$HOME/tmp_lailaba_test"; rm -rf "$LAILABA_HOME"; mkdir -p "$LAILABA_HOME"
bash "$BUILD/install.sh"
# confirm: skills/<cat>/SKILL.md present, skins/hackers.yaml, scripts/ipwatchdog.sh, memories/*
rm -rf "$LAILABA_HOME"; bash -n "$BUILD/install.sh"
```

## 6. Commit + push (PRIVATE by default)
```bash
cd "$BUILD"
git init -q && git add -A
git -c user.name="A. I. LAILABA" -c user.email="abstryaproject@users.noreply.github.com" \
  commit -q -m "Initial commit: custom lailaba-agent layer"
gh repo create lailaba-agent --private \
  --description "Custom Lailaba agent layer (skills, hackers skin, config, scripts) over upstream Hermes — installable via install.sh" \
  --homepage "https://github.com/abstryaproject/lailaba-agent"
git branch -M main
git remote add origin https://github.com/abstryaproject/lailaba-agent.git
git push -u origin main
```

## 7. Verify on GitHub
```bash
gh repo view abstryaproject/lailaba-agent --json name,isPrivate,url,defaultBranchRef
gh api repos/abstryaproject/lailaba-agent/contents --jq '.[].path'
```

## Outcome from the session that produced this skill
- Repo `abstryaproject/lailaba-agent` created PRIVATE, 34 files, 873K.
- Installer verified in a throwaway home (8 SKILL.md, skin, script, memories landed).
- User clarified: "custom agent" = `~/.lailaba`, NOT the upstream
  `~/.hermes/hermes-agent` fork. Earlier confusion cost a misdirected stage attempt.
- A public `gh repo create` was BLOCKED by the user -> default PRIVATE now.
