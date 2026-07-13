# Verify on the ACTUAL DEVICE before declaring done

The user's standing rule: **"verify it because it not work for my site. alway verify before done."**
This session proved why — a feature passed every server-side test but broke in the browser.

## The bug this caught
We built a "Launch live lab" button whose iframe `src` was `/lab-runtime-frame.html`.
Every `curl …/lab-runtime/…` proxy test returned 200 and every exploit flag was captured.
But the lab static files are mounted under `/lab/`, so the page's real URL is
`/lab/lab-runtime-frame.html`. The browser requested `/lab-runtime-frame.html` → **404 → blank
iframe**. Server-side proxy success ≠ browser success. Fixed by pointing the iframe at
`/lab/lab-runtime-frame.html`.

## Discipline (do this for ANY frontend deliverable)
1. After editing `lab/index.html` / `app.js` / `css`, `curl` the **served** file (not the source
   on disk) and grep it for the exact paths / element IDs the JS references.
   - `curl -s http://127.0.0.1:8000/lab/ | grep -oE 'id="(level-rail|arena-card|training-modal|…)"'`
   - `curl -s http://127.0.0.1:8000/lab/js/app.js | grep -nE 'src=|/lab/|/lab-runtime'`
2. Cross-check every `getElementById` / `querySelector` in `app.js` against IDs present in the
   served `index.html`. A missing ID = runtime `null` error in the browser, invisible to curl.
3. For iframes / fetch targets, confirm the FULL path the browser will request actually 200s:
   `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/<exact-path-from-JS>`.
4. `node --check` any JS you touched (catches syntax errors curl can't).
5. Only then declare done. If you cannot run a real browser here, SAY SO and list exactly what was
   and wasn't tested — don't imply the render was verified.

## Why proxy curls aren't enough
- A reverse-proxy test confirms the *backend* answers. It says nothing about whether the frontend
  points at the right path, whether the HTML has the element the JS expects, or whether a static
  asset 404s. Those are the bugs that burn the user on their device.
- The user runs this on Termux/armv7l — different from a dev box. Always test against the RUNNING
  server on `:8000`, not a mental model of the code.
