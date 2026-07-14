---
name: lailaba-termux-recipes
description: Termux/arm-specific workarounds and recovery recipes for the self-hosted Lailaba stack that are NOT in the bundled (read-only) skills. Two verified recipes live here — (1) restoring the Lab feature from its removal git stash WITHOUT `git stash pop` (the working tree has diverged, so pop aborts), and (2) getting a STABLE Cloudflare *.workers.dev domain when `wrangler` cannot run on Android/arm (workerd has no arm binary). This skill is the writable companion to the bundled `lailaba-termux-stack` and `lailaba-lab-training-rooms` skills (those are read-only on this deploy — put new recipes/workarounds here, not there). Load this when the user asks to restore the Lab, or to get a permanent/stable domain/tunnel URL.
---

# Lailaba Termux recipes (arm-specific workarounds)

Companion to the bundled `lailaba-termux-stack` and `lailaba-lab-training-rooms` skills.
Those bundled skills are READ-ONLY on this deploy (curator refuses edits), so any new
Termux/arm workaround or recovery recipe is captured here instead.

## Recipe A — Restore the Lab from its removal git stash
The Lab (Arena + Live Range) was removed this session and its code saved in `git stash`.
A plain `git stash pop` ABORTS because the working tree carries uncommitted theming/admin/PWA
edits that now overlap the stash's lab wiring. Restore surgically:
- Restore the standalone (deleted, not modified) lab files via `git checkout stash@{0} -- …`.
- Re-apply the 3 core re-wires (database.py LabProgress+LabReward, config.py LAB_ARENA_REALTIME,
  main.py router + /lab static mount + rate-limit exemption) by hand onto the CURRENT tree.
- Restart the server (kill + relaunch separately — `pkill` self-matches the shell wrapper) and
  start the Live Range (`tmux lailaba-lab`).
Full exact blocks + verify transcript: `references/lab-restore-from-stash.md`.

## Recipe B — Stable Cloudflare domain (wrangler is dead on arm)
The default tunnel is a rotating quick tunnel. A free STABLE `*.workers.dev` name needs a
Cloudflare Worker reverse-proxying to the current quick-tunnel URL held in a KV namespace.
`wrangler` (npm -g) installs but crashes at runtime on this armv7l Termux (`workerd` has no
Android/arm build → `Unsupported platform: android arm LE`, even on `wrangler kv list`). So
deploy via the Cloudflare REST API with `curl` instead. On-device pieces already staged:
`~/cloudflare-worker/worker.js`, `~/.local/bin/cloudflared-keepalive-stable.sh`,
`~/.local/bin/deploy-stable-domain.sh`. Needs user-supplied `CF_API_TOKEN` (Workers
Scripts:Edit, Workers KV Storage:Edit, Account Settings:Read) + `CF_ACCOUNT_ID`.
Full API shapes + recipe: `references/stable-domain-cloudflare.md`.

## When to load
- User: "restore the lab", "bring back training rooms", or after a lab-removal session.
- User: "permanent domain", "stable link", "stop the URL rotating", "custom domain".
- A `git stash pop` fails with a merge/conflict error on the Lailaba tree.
- `wrangler` errors with `Unsupported platform: android arm LE`.
