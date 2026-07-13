# Live Range iframe — hacker/matrix theme recipe

The Live Range iframe (Challenge 1) HTML is a single module-level string `HTML = """..."""` in
`lab/runtime/labserve.py` (served at `/api/lab/runtime/`, tmux `lailaba-lab` / `live-range`).
The user wants the **hacker / cyberpunk ("matrix")** look on this surface too: neon green
`#00ff41` on true-black, monospace, CRT scanlines, text glow, terminal prompts. This matches the
dashboard `cyberpunk` theme they set via `lailaba config set dashboard.theme cyberpunk` — keep the
Lab consistent with that.

## Constraints (don't break the gating)
The served `<script>` builds the level cards by referencing FIXED class/var names. **Keep every
CSS class and `:root` variable name identical** or the JS-driven content (level cards, solved
state, progress bar, postMessage unlock) breaks:
- classes the JS reads/writes: `.lvl`, `.status`, `.status.solved`, `.desc`, `.card`, `.row`,
  `input`, `button`, `pre`, `.flag`, `.blocked`, `code`, `.next`, `.done`, `.done .big`,
  `.done .note`, `.bar`, `.bar>i`, `.lvcount`, `.lvdiff{slow|medium|hard|elite}`, `.legend`, `.sub`.
- vars the JS/CSS use: `--acc`, `--mut`, `--gold`, `--red`, `--bd`, `--bg`, `--bg2`, `--fg`.
- `KEY='lailaba_range_v12'` and `postMessage({type:'lailaba_range_done',version:'v12'})` are NOT CSS
  — never touch them (the parent gates Challenge 2 off that message).
- If you introduce a NEW class in markup (e.g. `<span class="mut">`), you MUST also define it in
  `<style>` (`.mut{color:var(--mut)}`) or it renders unstyled.
- Cosmetic-only additions are safe and don't affect layout or JS hooks: `body::after` scanline
  overlay, `@keyframes flicker`, `h1::before{content:"> "}`, `lvcount::before{content:"root@lailaba:~# "}`,
  `status.solved::before{content:"[+] "}`, `.next::before{content:"$ "}`.

## Known-good theme block (applied 2026-07-13)
Replace the `:root{...}` line and the `body{...}` rule, and append the overlay + keyframes. Keep the
variable NAMES (only the values change to matrix-green):
```css
:root{--bg:#000600;--bg2:#020a02;--fg:#00ff41;--mut:#1f8f3a;--acc:#00ff41;--bd:#0c3a14;--red:#ff3b3b;--gold:#ffd24a;--glow:0 0 6px rgba(0,255,65,.55)}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:radial-gradient(120% 120% at 50% 0,rgba(0,255,65,.06),transparent 60%),#000600;
  color:var(--fg);font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  padding:18px;position:relative;text-shadow:var(--glow);animation:flicker 6s infinite}
body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,.28) 3px,rgba(0,0,0,0) 4px);
  mix-blend-mode:multiply;opacity:.5}
@keyframes flicker{0%,19%,21%,23%,80%,100%{opacity:1}20%,22%{opacity:.93}}
```
Then add the `.mut` helper and reuse the existing terminal-prompt pseudo-elements:
```css
.mut{color:var(--mut)}
h1::before{content:"> ";color:var(--mut)}
.lvcount::before{content:"root@lailaba:~# ";color:var(--mut);font-weight:400}
.status.solved::before{content:"[+] "}
.next::before{content:"$ ";color:var(--mut);font-weight:400}
/* also: .bar>i and pre get box-shadow:var(--glow); inputs get caret-color:var(--acc)+focus glow */
```
JS-label tweaks in `render()` (purely visual, keep all IDs):
- `chead` -> `<span class="lvl">[lvl ${n}] ${title}</span>` + `<span class="status" id="st${n}">[*] active</span>`
- `<pre id="o${n}"><span class="mut">$ awaiting input...</span></pre>` (needs `.mut` defined above).

## Restart + verify
labserve.py reads `HTML` at import time, so an edit is NOT live until you restart the process.
Kill the OLD instance FIRST (see the `pkill` self-match pitfall), then:
```bash
tmux new-session -d -s live-range 'python3 lab/runtime/labserve.py'
sleep 3
curl -s http://127.0.0.1:8080/ | grep -oE "root@lailaba:~\#|--glow|flicker|\[lvl |awaiting input" | sort -u
# expect: --glow  [lvl   awaiting input   flicker   root@lailaba:~#
```
(The `#` is literal text, not a shell comment — the grep "stray \ before #" warning is harmless.)
No FastAPI restart needed — `/lab` static assets and the `/api/lab/runtime/*` proxy are unaffected;
only the sandbox process serves the new HTML. Confirm the proxy still drives a real exploit:
`curl -s "http://127.0.0.1:8000/api/lab/runtime/api/orders?user=0" | grep LAB\{idor`.
