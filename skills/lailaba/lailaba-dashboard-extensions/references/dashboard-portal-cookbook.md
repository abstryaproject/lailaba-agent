# Dashboard / Portal Cookbook — concrete snippets

## 1. Config key scan (handles dual LAILABA_HOME)

```python
def _load_api_server_cfg():
    import yaml
    from pathlib import Path
    files = []
    env_home = os.environ.get("LAILABA_HOME")
    if env_home:
        files.append(Path(env_home) / "config.yaml")
    files += [Path.home()/".lailaba"/"config.yaml", Path.home()/".hermes"/"config.yaml"]
    for cfg_path in files:
        try:
            cfg = yaml.safe_load(open(cfg_path)) or {}
        except Exception:
            continue
        for b in [cfg.get("gateway",{}).get("platforms",{}).get("api_server",{}),
                  cfg.get("platforms",{}).get("api_server",{})]:
            if not b: continue
            k = (b.get("extra") or {}).get("key") or b.get("key") or ""
            if k:
                return {"host": b.get("host","127.0.0.1"),
                        "port": int(b.get("port",8642)), "key": k}
    return {"host":"127.0.0.1","port":8642,"key":""}
```

## 2. Chat reply unwrap (api_server /chat double-encodes)

```python
def _extract_reply(data):
    if isinstance(data, dict):
        if "message" in data and isinstance(data["message"], dict):
            c = data["message"].get("content")
            if isinstance(c, str): return c
        raw = data.get("reply") or data.get("response") or data.get("content")
        if isinstance(raw, str):
            raw = raw.strip()
            if raw.startswith("{"):
                try:
                    inner = json.loads(raw)
                    if isinstance(inner, dict):
                        msg = inner.get("message") or {}
                        if isinstance(msg, dict) and isinstance(msg.get("content"), str):
                            return msg["content"]
                        if isinstance(inner.get("content"), str):
                            return inner["content"]
                except Exception: pass
            return raw
    return json.dumps(data, default=str)[:2000]
```

## 3. TTS with async wait

```python
out = Path.home()/".lailaba"/"portal_files"/f"tts_{uuid.uuid4().hex}.ogg"
res = await asyncio.to_thread(text_to_speech_tool, text=req.text, output_path=str(out))
for _ in range(40):                      # up to ~20s; file lands asynchronously
    if out.exists() and out.stat().st_size > 0: break
    await asyncio.sleep(0.5)
if not out.exists() or out.stat().st_size == 0:
    raise HTTPException(500, "TTS produced no file")
return FileResponse(str(out), media_type="audio/ogg", filename="reply.ogg")
```

## 4. STT (returns a dict)

```python
result = await asyncio.to_thread(transcribe_audio, str(tmp))
text = result.get("transcript") if isinstance(result, dict) else str(result)
```

⚠️ In-process STT via `asyncio.to_thread` HANGS in the live dashboard (HTTP=000). Use a
`subprocess` helper instead until root-caused.

## 5. Restart dashboard safely

```bash
P=$(pgrep -f "[l]ailaba dashboard" | head -1); kill -9 "$P"   # bracket trick = no self-match
rm -f lailaba_cli/__pycache__/portal_api*.pyc
tmux kill-session -t hermes-dashboard
tmux new-session -d -s hermes-dashboard -x 120 -y 40
tmux send-keys -t hermes-dashboard "export LAILABA_HOME=\$HOME/.hermes; cd \$HOME/.hermes/hermes-agent && source venv/bin/activate && lailaba dashboard --port 9119 --host 0.0.0.0 --no-open --skip-build" Enter
# dashboard takes ~18-30s to bind; poll /portal for 200 before testing
```

## 6. Restart gateway fresh (clears stale-boot 401)

```bash
P=$(pgrep -f "[l]ailaba gateway run" | head -1); kill -9 "$P"
tmux kill-session -t hermes-gateway
tmux new-session -d -s hermes-gateway -x 120 -y 40
tmux send-keys -t hermes-gateway "cd \$HOME && exec \$HOME/bin/lailaba gateway run" Enter
# wait ~20s; verify: curl -H "Authorization: Bearer $KEY" http://127.0.0.1:8642/api/sessions
```

## 7. curl output path MUST be writable

`curl ... -o /tmp/x.ogg` FAILS silently (size 0) — /tmp is read-only. Save to
`~/.lailaba/portal_files/x.ogg` to confirm TTS/file responses actually have bytes.
