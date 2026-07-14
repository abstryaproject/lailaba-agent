# PWA icon / logo generation from a source image (Termux + PIL)

## When
User supplies an image and wants it as the app logo / PWA icons (replacing the old
ones). Works even when the vision model is rate-limited (free tier ~50 req/day) — fall
back to PIL pixel analysis (luminance threshold + ASCII brightness map) to "see" the shape.

## Pipeline (Python + PIL — app venv or execute_code sandbox venv)
1. `im = Image.open(src).convert("RGB")`. Find the subject by luminance `> ~35`
   (the source was a near-black image with a light mark). Record its bbox.
2. Build an alpha mask from luminance, softened with `GaussianBlur(1.2)`; extract the
   mark as RGBA on transparent.
3. Crop to bbox. **Recolor to theme** `#10a37f`: `out = (theme_r, theme_g, theme_b) * (lum/255)`,
   keep original alpha. (This preserves the mark's shape/luminance, applies brand color.)
4. Export (all RGBA, into `app/static/icons/`):
   - transparent green mark: `icon-green-192.png`, `icon-green-512.png`
   - solid maskable (green bg `#10a37f` + WHITE mark, ~62% size, centered):
     `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`(180), `favicon.png`(64)
   - full-bleed maskable (mark ~80% size, safe-zone for `purpose:"maskable"`):
     `icon-maskable-192.png`, `icon-maskable-512.png`
5. Update `app/static/manifest.json` `icons[]` to declare BOTH
   `{"purpose":"any"}` (icon-192/512) and `{"purpose":"maskable"}` (icon-maskable-192/512).

## Verify (end-to-end, over the tunnel too)
```bash
B="https://<your-tunnel-url>"
for i in icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png favicon.png; do
  curl -s -o /dev/null -w "$i -> %{http_code} %{content_type}\n" --max-time 15 "$B/static/icons/$i"
done
curl -s -o /dev/null -w "manifest -> %{http_code} %{content_type}\n" --max-time 15 "$B/manifest.json"
curl -s -o /dev/null -w "sw -> %{http_code} %{content_type}\n"       --max-time 15 "$B/sw.js"
# expect all 200, png/json/javascript correct
```

## Notes / pitfalls
- Write previews/diffs to `~/.local/tmp` — `/tmp` is read-only on this Termux build.
- `execute_code` sandbox CAN call PIL but CANNOT call `curl` (PermissionError) — fetch via
  the `terminal` tool instead, then diff in Python if needed.
- The maskable variants need a full-bleed safe area (Cloudflare/Android mask ~40% edges);
  keep the mark centered and <80% of canvas.
- `index.html` is what `/` serves; if the user references "the chat page" make sure you
  edit the file that route actually returns (see SKILL.md frontend-routing pitfall).
