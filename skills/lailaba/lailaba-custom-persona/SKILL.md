---
name: lailaba-custom-persona
description: Build / update Lailaba's "custom model" via the SOUL.md persona layer — bake the user's identity, skills, memory, and domain specialization (security, coding, general) into the agent's core system prompt. Covers where SOUL.md lives, the dual-home gotcha that silently deactivates a persona on the user's main channel, and how to verify it's live. Trigger on "build a custom model for me", "make it specialized in X", "customize my agent", "give it a persona", "it's not acting like my agent", or any request to shape the agent's identity/behavior per user profile.
---

# Lailaba Custom Persona (SOUL.md)

Lailaba has no weight-retraining on-device (Termux/Android, armv7l, ~1.8GB RAM).
The real "custom model" is the **SOUL.md persona file**: it is auto-injected as the
agent's PRIMARY identity, replacing the default, and is **loaded fresh every message**
(no restart needed to apply edits). This is the correct lever for "build a custom model
based on my skills/memory covering cybersecurity, coding, general knowledge."

## Where SOUL.md lives — THE dual-home gotcha (read first)

Lailaba resolves `LAILABA_HOME` differently per process. A persona you write in ONE
place will be **silently ignored** on your main channel if you pick the wrong path:

| Surface            | Reads SOUL.md from        | How LAILABA_HOME is set                          |
|-------------------|---------------------------|--------------------------------------------------|
| Telegram gateway  | `~/.lailaba/SOUL.md`     | defaults to `~/.lailaba` (gateway has NO env override) |
| CLI / `lailaba`  | `~/.hermes/SOUL.md`      | `LAILABA_HOME=~/.hermes` (bundle sets this)     |
| Web dashboard     | `~/.hermes/SOUL.md`      | `LAILABA_HOME=~/.hermes` (service-manager sets this) |

**Practical rule:** deploy your persona to **BOTH** `~/.lailaba/SOUL.md` AND
`~/.hermes/SOUL.md` so it's active on Telegram AND the CLI. If you only edit one,
the other channel keeps the default identity and the user thinks "it's not working."

Verify which path a running process uses:
```bash
P=$(pgrep -f "lailaba gateway run" | grep -v bash | head -1)
tr '\0' '\n' < /proc/$P/environ 2>/dev/null | grep -iE "^LAILABA_HOME="
# empty => defaults to ~/.lailaba  (this is where the gateway reads SOUL.md)
```

## How to write it

`SOUL.md` is plain markdown, injected as system prompt. Keep it targeted — the
agent already has base capabilities; the file should ADD identity + specialization +
operating rules, not re-teach basics. Structure that worked well for a
security/coding-focused owner:

```
# Lailaba AI — Specialized Persona (Owner Name / AI Agent)

## Identity
- Name, owner. Direct/terse/build-first style. Match user's language exactly.
- Report HONEST status with real runnability flags; END-TO-END verify before claiming done.

## Core Specializations (priority order)
1. CYBERSECURITY & ETHICAL HACKING — AUTHORIZED-ONLY, defensive-first,
   confirm before destructive commands.
2. PROGRAMMING & ENGINEERING — ship WORKING code, verify it runs.
3. GENERAL KNOWLEDGE.

## Local Capabilities (pull from the user's memory)
- Security toolkit paths, device constraints (/tmp read-only -> ~/.local/tmp),
  venv-only pip, no Docker/PHP/Java.
- User's recurring preferences (game-like progression, build-don't-ask, etc.)

## Operating Rules
- Authorized-only targeting; sandbox malware analysis; confirm destructive ops.
```

Bake in the user's actual MEMORY.md / USER.md facts (skills, toolkit, preferences)
so the persona is genuinely "based on my skills and memory" — not generic.

## Apply it

SOUL.md is read per-message, so just **write the file** — no restart. To confirm
it's live, message the agent on the target channel and ask it to state its
specializations; it should echo your priority order.

## Pitfalls

- **Edit BOTH homes** (see gotcha above) or the main channel stays default.
- **Don't put secrets / API keys** in SOUL.md — it's injected into context and
  logged in redacted form; keep credentials in `~/.lailaba/.env`.
- The `lailaba config set agent.system_prompt "..."` path ALSO exists (single
  string, no markdown structure) but SOUL.md is the richer, file-based route and
  is what `doctor.py` checks for ("SOUL.md exists (persona configured)").
- SOUL.md has a soft char cap that scales with the model's context window
  (floor 20K); for practical personas you'll never hit it — but keep it focused.
- Don't confuse SOUL.md (identity) with `agent.personalities` in config.yaml
  (named switchable personas used via `/personality <name>`). SOUL.md is the
  always-on base; personalities are opt-in toggles.
