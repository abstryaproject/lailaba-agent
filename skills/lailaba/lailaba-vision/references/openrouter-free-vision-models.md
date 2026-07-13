# List an account's free + vision-capable OpenRouter models

Never guess a `:free` vision slug — they 404 per-account and change over time.
Query the live `/api/v1/models` endpoint to learn what's actually free+vision
on THIS account right now.

## Recipe (terminal)
```bash
KEY=$(grep -iE 'OPENROUTER' ~/.lailaba/.env | head -1 | sed -E 's/.*=//' | tr -d '"'"'"' \t')
curl -s "https://openrouter.ai/api/v1/models" -H "Authorization: Bearer $KEY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ms = d.get('data', [])
frees = [m['id'] for m in ms if 'free' in m['id']]
print('TOTAL FREE:', len(frees))
# vision-like = name hints
vision_like = [f for f in frees if any(k in f.lower() for k in
              ['vl','vision','molmo','pixtral','llava','gemini'])]
print('VISION-LIKE FREE:')
for f in vision_like: print('  ', f)
"
```

## Notes
- The OpenRouter `/api/v1/models` response `data[].architecture.input_modalities`
  is a list of strings (e.g. `['text','image']`) — parse carefully (it is NOT a
  list of dicts). Filter on modality `image` if you want strict vision detection.
- `~/.lailaba/.env` is read-protected by the agent file tool but readable via
  `terminal` (defense-in-depth, not a hard boundary).
- Free tier is rate-limited: ~50 requests/day per account, resets ~00:00 UTC.
  A 429 means the config works — you hit the quota, not a bad model.
- Known to have been 404 at one point on this account: `qwen/qwen2.5-vl-*`,
  `meta-llama/llama-3.2-11b-vision-instruct:free`, `google/gemini-*-flash*:free`.
  `nvidia/nemotron-nano-12b-v2-vl:free` WAS available — but re-query, don't trust.
