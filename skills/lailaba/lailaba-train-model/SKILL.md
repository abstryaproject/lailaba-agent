---
name: lailaba-train-model
description: Build, train, and deploy a CUSTOM Lailaba LLM (real weights) from the user's skills and memory, served via OpenRouter like tencent/hy3:free. Covers corpus harvest, SFT dataset synthesis via the OpenRouter API, QLoRA fine-tune with Axolotl, HuggingFace publish, and wiring into Lailaba. Trigger on "build/train a custom model", "model like hy3", "custom LLM", "fine-tune for Lailaba", "train a model from my skills".
---

# Train a Custom Lailaba Model (real weights)

## CRITICAL distinction — what the user means
When Abdullahi says "build custom model" or "model like hy3:free", he means a
REAL trainable LLM (weights) served through OpenRouter — NOT a SOUL.md
persona edit. The lailaba-custom-persona skill covers ONLY SOUL.md; do not
confuse the two. He explicitly corrected a SOUL.md-only interpretation. The
deliverable is a model id selectable in Lailaba exactly like tencent/hy3:free.
(NOTE: lailaba-custom-persona is mis-named — "custom model" to this user =
weights, not persona. Flag the naming collision to the curator; don't let it
steer you.)

## Pipeline (build locally, train on a GPU host)
1. **Harvest corpus** — read every SKILL.md under ~/.lailaba/skills/**, plus
   MEMORY.md, USER.md, SOUL.md from ~/.lailaba and ~/.hermes. Concatenate into
   one corpus_combined.txt. (~90 sources, ~1 MB is plenty.)
2. **Synthesize SFT data** — call OpenRouter (tencent/hy3:free) to turn corpus
   chunks into (instruction, output) Alpaca pairs in the agent's terse
   security/engineering voice. SEE references/openrouter_hy3_reasoning_quirk.md
 — hy3:free is a REASONING model; you MUST read message.reasoning (content is
 null) and raise max_tokens or you get empty/null outputs. SEE
 references/dataset_synthesis.md for the script pattern. SEE
 references/wire_multi_agent.md for agent-agnostic (Lailaba/Hermes/OpenClaw)
 wiring after publish.
3. **Clean + split** — dedup (hash), drop rows with <8 char fields, 5% val.

## Agent-agnostic / portable dataset (KEY requirement from user)
The user explicitly required the custom model to work in ANY agent (Lailaba,
Hermes, OpenClaw, etc.) — NOT locked to Lailaba branding. Two variants exist:
- `synthesize_dataset.py` — instructions prefixed "Lailaba, ..." (branded wake-word).
- `synthesize_portable.py` — **preferred**: instructions addressed to a
  GENERIC assistant, NO brand name anywhere; outputs have any stray "Lailaba"
  replaced with "[ASSISTANT]". The model learns CAPABILITIES (authorized-only
  security, coding, general knowledge) + the terse build-first voice, NOT a
  name. Each agent layers its OWN identity via its system prompt / SOUL.md /
  persona file at runtime.

Why this matters: ship the portable variant. One model published once to HF +
registered once on OpenRouter; every agent references the SAME id
(`<you>/lailaba-qwen15`). No retraining per agent. Identity stays per-agent.
Wiring per agent: references/wire_multi_agent.md (Lailaba/Hermes/OpenClaw all
point at the same OpenRouter id or a shared vLLM endpoint).
4. **Fine-tune** — Axolotl QLoRA on a GPU host (Colab T4 / RunPod / Modal).
   Base: Qwen/Qwen2.5-1.5B-Instruct (hy3 size class, cheap to train).
   Config: templates/axolotl_config.yml. Notebook: templates/Colab_Train_Lailaba.ipynb.
5. **Publish** — merge LoRA to base, push to HF (huggingface-cli upload).
6. **Wire into Lailaba** — register the model on OpenRouter (Create Model
   points at an OpenAI-compatible endpoint), then:
   lailaba config set model.default '<you>/lailaba-qwen15'
   lailaba config set model.provider openrouter
   It now appears as a selectable model like hy3:free.

## Where each step runs
- Corpus harvest + dataset synthesis: run on the phone/Termux (light text +
  API calls only, no heavy compute).
- Fine-tune + publish: run on a GPU machine. This is standard ML offload
  (training needs a GPU), not a device limitation to flag to the user — just
  build the artifacts and point them at Colab/RunPod.

## Hard-won pitfalls
- hy3:free reasoning quirk (null content) -> references/openrouter_hy3_reasoning_quirk.md
- Dual LAILABA_HOME: the Telegram gateway reads ~/.lailaba/SOUL.md (default when
  LAILABA_HOME is unset); the CLI/bundle reads ~/.hermes/SOUL.md. Persona edits
  must go to BOTH or the active channel won't reflect them.
- Free-tier rate/latency: ~15-20s per call. Chunk corpus at ~14k chars with
  1.5k overlap (~50 chunks). Add retry+backoff (3 attempts) + 120s timeout.
- pkill -f self-match: a shell whose own cmdline contains the pattern kills
  itself. Kill background Python by explicit PID, not by pattern.

## Working repo from the session that built this
~/custom-model/{corpus,dataset,configs,scripts} + Colab_Train_Lailaba.ipynb
(synthesizer, cleaner, publish script, axolotl config, Colab notebook).
