# Gateway health verification — "running" ≠ "working"

`lailaba gateway status` confirms only that the gateway **PID is alive**. It does
NOT mean the gateway is serving messages. This is the single most common false
"it's up" report.

## The wedge: APITimeoutError → context-compaction loop
On free-tier OpenRouter models (e.g. `tencent/hy3:free`, the gateway's default),
the gateway's internal agent loop can get stuck:
- Every OpenRouter call times out: `APITimeoutError`, ~70–115s each, 3 retries.
- It then tries to "compact" the bloated session context (often 90k+ tokens /
  200+ messages) — which is *also* an API call that times out.
- So it loops forever printing errors while `lailaba gateway status` still says ✓ running.

Log signature:
```
⚠ API call failed (attempt 3/3): APITimeoutError
  Provider: openrouter  Model: tencent/hy3:free
  Elapsed: 114.99s  Context: 239 msgs, ~93,320 tokens
🗜 Compacting context — summarizing earlier conversation...
```

## Verify before declaring success
```bash
tmux capture-pane -t hermes-gateway -p 2>/dev/null | grep -ciE "timeout|error|fail"   # 0 = clean
tmux capture-pane -t hermes-gateway -p 2>/dev/null | tail -n 20
```

## Prove the key + model are fine (wedge is usually the session, not credentials)
A tiny direct request usually succeeds even while the gateway is wedged:
```bash
KEY=$(grep -E '^OPENROUTER_API_KEY=' ~/lailaba-ai/.env | cut -d= -f2-)
curl -s -m 60 -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -X POST https://openrouter.ai/api/v1/chat/completions \
  -d '{"model":"tencent/hy3:free","messages":[{"role":"user","content":"hi"}],"max_tokens":20}'
```
If that returns a completion, the key/model work — the wedge is the gateway's
oversized session + free-tier throttling, not a credential fault.

## Fix: kill + relaunch fresh (drops the bloated session)
```bash
lailaba gateway stop; tmux kill-session -t hermes-gateway 2>/dev/null
pkill -f "lailaba gateway run"
sleep 2
tmux new-session -d -s hermes-gateway
tmux send-keys -t hermes-gateway "lailaba gateway run" Enter
sleep 10
tmux capture-pane -t hermes-gateway -p 2>/dev/null | grep -ciE "timeout|error|fail"   # expect 0
```

## If timeouts recur under load
Switch the gateway's model to a paid/faster OpenRouter model — free-tier models
are rate-limited and slow, and large contexts make timeouts near-certain.
