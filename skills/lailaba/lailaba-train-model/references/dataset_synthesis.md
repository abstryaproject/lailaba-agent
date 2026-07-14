# SFT dataset synthesis pattern (from user's skills/memory -> Alpaca pairs)

Used by the custom-model pipeline to turn a harvested corpus into training
examples. The agent itself (hy3:free) generates the pairs.

## Chunking
- Corpus ~1 MB -> split at `size=14000, overlap=1500` chars (~50 chunks).
  Smaller chunks (6000/800) produced ~197 chunks = too slow on free tier.
- Rotate DOMAIN focus per chunk (cybersecurity / programming / general) so the
  dataset has balanced coverage.

## Prompt
- SYSTEM: "You are a dataset synthesizer... output STRICT JSON array of
  {instruction, output} objects (and input='' when not needed). 3-5 examples
  per chunk. No commentary, no markdown fences."
- USER: feed the chunk + domain hint; ask for terse, build-first,
  authorized-only security responses in the agent's voice.

## Builder target
```
def call_api(domain_hint, chunk):
    body = {"model":"tencent/hy3:free","messages":[...],"temperature":0.7,"max_tokens":3000}
    # urllib POST with Bearer key; on success read msg.get("content") or msg.get("reasoning")
    # retry 3x, timeout 120s

def parse_examples(text):
    # strip ```json fences; json.loads; keep dicts with instruction+output
    # len(instruction)>=8 and len(output)>=8
```

## Cleaning (separate script)
- hash(instr+out) dedup; drop short rows; seed=42 shuffle; 5% val split.
- Outputs: sft_clean.jsonl, sft_train.jsonl, sft_val.jsonl (Alpaca format:
  {instruction, input, output}).

## Key files (session repo ~/custom-model)
- scripts/synthesize_dataset.py  (API synthesis)
- scripts/clean_dataset.py       (dedup + split)
