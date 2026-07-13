# lailaba-agent

A **custom Lailaba agent configuration** — the portable layer built on top of the
[Lailaba AI](https://github.com/NousResearch/hermes-agent) agent. This repo contains
only YOUR customizations, not the upstream Hermes agent core.

## What's in here

```
skills/                  Your custom skills (not shipped with upstream)
  customization/         CLI skin + dashboard theming skills
  devops/                Termux services / boot-chain skill
  lailaba/               lailaba-ai server + lailaba services skills
  self-hosted/           Termux self-hosting stack + lab training-rooms skills
skins/
  hackers.yaml           Your "hackers" cyberpunk CLI skin
scripts/
  ipwatchdog.sh          IP watchdog cron script
memories/
  MEMORY.md              Agent's durable memory notes
  USER.md                User profile
config.yaml.example      Reference config (cyberpunk dashboard, model, skin)
install.sh               Installer: lays these files into ~/.lailaba on a target host
```

## Prerequisites
- A working Lailaba AI agent install (CLI + gateway). This repo is an *add-on*.
- `git`, `bash`. On Termux: Termux:Boot add-on for the boot-chain watchdog.

## Install (on another machine)
```bash
git clone https://github.com/abstryaproject/lailaba-agent.git
cd lailaba-agent
./install.sh
```
The installer: copies skills into `~/.lailaba/skills/...` (skips existing unless
`--force`), installs `skins/hackers.yaml`, places `ipwatchdog.sh`, imports memories
if absent, and refuses to overwrite an existing `config.yaml`.

## Notes
- **No secrets committed.** `config.yaml.example` is behaviour only; API keys live
  in the target's `.env`/`config.yaml` and are never touched by this installer.
- To update an installed copy: `./install.sh --force`.

## Updating this repo from your live agent
```bash
cd ~/build/lailaba-agent  # the staging repo
# copy changed skills back in, then:
git add -A && git commit -m "sync custom agent layer" && git push
```
