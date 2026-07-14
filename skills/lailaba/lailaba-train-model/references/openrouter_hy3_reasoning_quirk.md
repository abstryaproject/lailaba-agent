# OpenRouter `tencent/hy3:free` is a REASONING model — gotcha

When calling `tencent/hy3:free` (or any reasoning-class model) via the
OpenRouter chat completions API, the visible `message.content` is often
`null` even on a successful 200 response. The actual generated text lives in
`message.reasoning` (OpenRouter exposes the chain-of-thought field).

## Symptom
- HTTP 200, `choices[0].message.content` == `None`
- `finish_reason` may be `length` if `max_tokens` is too low (reasoning eats
  the budget before `content` is populated)
- Naive parser `data["choices"][0]["message"]["content"]` -> `TypeError:
  'NoneType' object is not subscriptable` (or empty dataset rows)

## Fix (do this in every parser)
```
msg = data["choices"][0]["message"]
content = msg.get("content") or msg.get("reasoning") or ""
```
And raise `max_tokens` to ~3000 so reasoning completes and `content`
populates. For the chat UI you may want only `content`, but for dataset
synthesis/extraction, fall back to `reasoning` so you don't lose everything.

## Latency / limits (free tier, observed)
- ~15-20s per call, single request
- Rate-limited; add retry (3 attempts) + 120s timeout + small sleep between calls
- `max_tokens` 1500 is too low for reasoning+content; use 3000
