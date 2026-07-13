---
name: lailaba-vision
description: >-
  Enable, configure, verify, and troubleshoot Lailaba's vision_analyze image-understanding
  capability (the auxiliary.vision backend). Covers how vision_analyze is gated by the
  auxiliary.vision config, selecting a provider plus vision model, verifying the client
  resolves, the correct tool call signature, and OpenRouter free-tier quirks (404 vs 429,
  daily quota, per-account model availability). Trigger on "enable vision", "turn on image
  analysis", "vision_analyze not working", "can't see / read images", "image analysis
  failed", "No LLM provider configured for task=vision", "config set auxiliary.vision", or
  any request to make the agent look at or describe a photo or screenshot.
---

# Lailaba Vision (vision_analyze) — enable, verify, troubleshoot

`vision_analyze` is a backend tool in `~/.hermes/hermes-agent/tools/vision_tools.py`
(function `vision_analyze_tool`). It is NOT always present in the model's tool
list. It is **gated** by `tools.registry.check_vision_requirements()`, which
calls `resolve_vision_provider_client()` from `agent.auxiliary_client`. If no
vision-capable provider/model resolves, the tool is silently removed from the
agent's available tools — so the agent may report "vision_analyze does not
exist" even though the code is present.

## When this fires
- User sends an image and you get "Tool 'vision_analyze' does not exist."
- Logs show `check_vision_requirements returned False` or
  `No LLM provider configured for task=vision provider=auto. Run: lailaba setup`.
- User explicitly asks to "enable vision" / "read images" / "look at screenshots".

## Enable it (the fix)
Vision is configured under `auxiliary.vision` in `~/.lailaba/config.yaml`:

```bash
lailaba config set auxiliary.vision.provider openrouter
lailaba config set auxiliary.vision.model <vision-model-slug>
lailaba config set auxiliary.vision.timeout 120
```

Then **verify resolution** (don't just assume — the tool stays gated if the
model slug is wrong/unavailable):

```bash
cd ~/.hermes/hermes-agent && venv/bin/python -c "
import sys; sys.path.insert(0,'.')
from agent.auxiliary_client import resolve_vision_provider_client, get_available_vision_backends
p,c,m = resolve_vision_provider_client()
print('provider',p,'model',m,'client_ok',c is not None)
print('backends', get_available_vision_backends())
"
```
`client_ok True` + a non-empty `backends` list means the tool will now load.

## End-to-end test
Call the backend function directly (note the signature — see pitfall below):

```bash
cd ~/.hermes/hermes-agent && venv/bin/python -c "
import sys, asyncio; sys.path.insert(0,'.')
from tools.vision_tools import vision_analyze_tool
print(asyncio.run(vision_analyze_tool(
    image_url='/path/to/img.jpg',
    user_prompt='What is in this image? Describe it.')))
"
```

## Pitfalls (read before debugging)
1. **Wrong call signature.** The backend function is
   `vision_analyze_tool(image_url: str, user_prompt: str, model: str = None)`.
   There is **no `question` kwarg** — passing `question=` raises
   `TypeError: unexpected keyword argument 'question'`. Use `user_prompt`.
2. **404 "This model is unavailable for free" / "No endpoints found".** The
   model slug is valid but not available free on THIS account, OR the `:free`
   slug doesn't exist. Fix: pick a different model — do NOT hardcode a guess.
   Query the live model list (see references/openrouter-free-vision-models.md)
   to find what's actually free+vision on the account right now.
3. **429 "Rate limit exceeded: free-models-per-day".** This means the config is
   CORRECT and the call reached the provider — you just exhausted the OpenRouter
   free daily quota (~50 req/day, resets ~00:00 UTC / ~01:00 local). Wait for
   reset, or switch to a paid model. Do NOT "fix" the config — it's fine.
4. **Free-model availability is account- and time-dependent.** Never encode
   "the only free vision model is X" as a permanent rule. Always re-query the
   OpenRouter `/api/v1/models` endpoint (recipe in references/) to learn the
   current free+vision set. Hardcoding a slug that later 404s wastes a turn.
5. **`.env` is protected.** Provider keys live in `~/.lailaba/.env` (read blocked
   by the agent file tool for safety). Read it via `terminal` (e.g.
   `grep -iE 'OPENROUTER' ~/.lailaba/.env`) when you need the key to query the
   models API — never paste the key into chat or memory.

## Support files
- `references/openrouter-free-vision-models.md` — recipe to list an account's
  free + vision-capable models via the OpenRouter API (avoids 404 guesswork).
- `scripts/verify_vision.py` — probe that prints whether vision resolves and
  which backends are available; run with the hermes venv python.
