# OpenRouter 401 "User not found" — diagnosis recipe

A chat failure like `[AI Service Error: {"error":{"message":"User not found.","code":401}}]`
is OpenRouter's OWN error echoed through the app — it does NOT mean a local DB user
is missing. OpenRouter returns `code:401` + `message:"User not found."` when the
`OPENROUTER_API_KEY` is invalid / expired / revoked. The word "User" refers to the
OpenRouter account behind the key, not your app's users.

## How the app surfaces it
In the `~/lailaba-ai` server, `app/services/ai_service.py` catches any non-200 from
OpenRouter and yields the raw response body wrapped as `[AI Service Error: <body>]`.
So the text you see in chat is byte-for-byte what OpenRouter returned. Do NOT confuse
it with the app's own local-auth 401 (`"User not found or deactivated"`, raised in
`app/core/dependencies.py:25` from `get_current_user`) — that one means the bearer
token's user_id genuinely isn't in the local DB. Two different "User not found" strings.

## Verify the key independently (no app needed)
```bash
KEY=$(grep -E '^OPENROUTER_API_KEY=' ~/lailaba-ai/.env | cut -d= -f2-)
# auth/key endpoint returns 200 + key metadata if valid, 401 if not:
curl -s -m 10 -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $KEY" https://openrouter.ai/api/v1/auth/key
# small chat completion probe (also proves the model works):
curl -s -m 60 -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -X POST https://openrouter.ai/api/v1/chat/completions \
  -d '{"model":"tencent/hy3:free","messages":[{"role":"user","content":"hi"}],"max_tokens":20}'
```
A valid key returns `HTTP_STATUS:200` on `/auth/key` with `"is_free_tier":...` etc.
A 401 with `{"error":{"message":"User not found.","code":401}}` means the key is dead.

## Distinction that matters
- If `/auth/key` → 401: the KEY is the problem. Replace `OPENROUTER_API_KEY` in
  `~/lailaba-ai/.env`, then **restart the server** (it reads the key at startup):
  ```bash
  tmux kill-session -t lailaba-server 2>/dev/null
  tmux new-session -d -s lailaba-server
  tmux send-keys -t lailaba-server \
    "cd ~/lailaba-ai && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000" Enter
  ```
- If `/auth/key` → 200 but chat still errors: the key is fine, the issue is the
  model name, payload, or a free-tier rate limit — inspect the actual error body.

## End-to-end live chat proof (bypasses local auth via guest endpoint)
```bash
curl -s -m 60 -X POST 127.0.0.1:8000/api/chat/guest/send \
  -H "Content-Type: application/json" -d '{"message":"Say hello in one word."}'
```
Expect streamed `data: {"content": "Hello."}` — confirms the full path
local server → OpenRouter → response works.

## NEVER fabricate or guess a key
OpenRouter validates every key against its owning account. A made-up/guessed key
reproduces the same 401. There is no "agent's own key" to substitute — the user must
supply one from their OpenRouter account (or repoint `OPENROUTER_BASE_URL` +
`OPENROUTER_MODEL` to any OpenAI-compatible endpoint).
