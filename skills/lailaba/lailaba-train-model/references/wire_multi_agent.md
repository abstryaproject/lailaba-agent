# Wiring the custom model into MULTIPLE agents (agent-agnostic)

The fine-tuned model is capability-only (no branding). Publish it ONCE to
HuggingFace, register ONCE on OpenRouter (Create Model -> point at an
OpenAI-compatible endpoint). Every agent references the SAME id.

## Model id after publish
    <you>/lailaba-qwen15        # e.g. abstryaproject/lailaba-qwen15

## Per-agent wiring
- **Lailaba** (this device):
    lailaba config set model.default '<you>/lailaba-qwen15'
    lailaba config set model.provider openrouter
- **Hermes**: same config (Lailaba IS Hermes under the hood) — set
  model.default in its config.yaml. Identity stays Hermes via its SOUL.md.
- **OpenClaw** (or any OpenAI-compatible agent):
    model = '<you>/lailaba-qwen15'
    base_url = 'https://openrouter.ai/api/v1'   (or your vLLM http://host:8000/v1)
    api_key = <OpenRouter key> (or 'sk-noauth' for local vLLM)
  OpenClaw's own persona/system prompt supplies identity.
- **Any 4th agent**: just point its model config at the same OpenRouter id.
  No new training.

## Why this works
- Dataset (sft_portable.jsonl) has NO assistant name in instructions/outputs.
- The model learns BEHAVIOR; each agent layers BRANDING via its own system
  prompt at runtime.
- Publish once, reference everywhere. Retraining per agent is never needed.
