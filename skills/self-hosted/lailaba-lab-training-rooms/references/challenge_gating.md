# Challenge 1 / Challenge 2 — nested game-progression gating

The user's standing mental model for the Lab is a GAME: sequential challenges, each
unlocking the next, with rising difficulty. A recurring ask is "Challenge 1 = Live Range,
Challenge 2 = Arena; hide Challenge 2 until Challenge 1 is fully done, like in game."

Pattern used (Lab, session 6): **Challenge 1 = Live Range** (the on-device sandbox iframe,
always visible) and **Challenge 2 = Arena / Break the Guardian** (hidden behind a lock
placeholder until ALL of Challenge 1's levels are solved).

## Why shared-localStorage + postMessage works
The Live Range iframe is served via the same-origin proxy (/api/lab/runtime/* -> :8080), so
the iframe's origin == the parent page's origin (the FastAPI :8000 host). Same origin =>
localStorage is shared between iframe and parent, and window.parent exists for postMessage.
(If you ever served the sandbox from a DIFFERENT origin, neither shared storage nor
window.parent works. Keep it proxied same-origin.)

## Mechanism
1. iframe writes solve-state to a fixed key, e.g. localStorage['lailaba_range_v12'] = JSON
   array of solved level numbers (1..12).
2. When all levels solved, the iframe calls
   window.parent.postMessage({type:'lailaba_range_done', version:'v12', total:12}, '*')
   and also sets the key to the full list (so a reload keeps C2 open).
3. Parent listens for that message AND, on DOMContentLoaded, reads the shared key directly
   (covers the case where the iframe already finished in a prior session). It then reveals C2.

## HTML shape (parent)
<div class="lab-challenges">
  <div class="challenge-chip active" id="chip-1">1 · Live Range · <span id="chip-1-sub">in progress</span></div>
  <div class="challenge-arrow">-></div>
  <div class="challenge-chip locked" id="chip-2">2 · Break the Guardian · <span id="chip-2-sub">locked</span></div>
</div>
<section class="lab-card lab-range" id="challenge-1"> ... iframe src="/api/lab/runtime/" ... </section>
<section class="lab-card" id="challenge-2" hidden> ... arena ... </section>
<section class="lab-card lab-locked-placeholder" id="challenge-2-locked"> lock icon · Challenge 2 locked </section>

## Parent JS predicates
const RANGE_STORAGE = 'lailaba_range_v12';
const RANGE_TOTAL = 12;
function rangeSolvedCount(){ try { return JSON.parse(localStorage.getItem(RANGE_STORAGE) || '[]').length; } catch(e){ return 0; } }
function isChallenge2Unlocked(){ return rangeSolvedCount() >= RANGE_TOTAL; }
function unlockChallenge2(announce){
  const c2 = document.getElementById('challenge-2');
  const locked = document.getElementById('challenge-2-locked');
  if (locked) locked.hidden = true;
  if (c2){ c2.hidden = false; c2.scrollIntoView({behavior:'smooth'}); /* + fireworks if announce */ }
  /* chip states... */
}
function lockChallenge2(){ const c2=document.getElementById('challenge-2'); const l=document.getElementById('challenge-2-locked'); if(c2)c2.hidden=true; if(l)l.hidden=false; }

## CSS gotcha
The `hidden` attribute is OVERRIDDEN by display:flex/grid/block rules, so a hidden card can
still render. Force it:
#challenge-2[hidden] { display: none; }
#challenge-2-locked[hidden] { display: none; }

## iframe side (labserve.py frontend)
On solving the last level, call notifyParent():
function notifyParent(){
  try { window.parent.postMessage({type:'lailaba_range_done', version:'v12', total:12}, '*'); } catch(e){}
  try { localStorage.setItem('lailaba_range_done','v12'); } catch(e){}
}
Also gate WITHIN the iframe one-by-one (level n unlocked only if n===1 || solved(n-1)), storing
to the same lailaba_range_v12 key so the parent sees progress.

## Verified gating logic (node simulation — run before declaring done)
function makeLS(val){ let s = val===undefined?"[]":JSON.stringify(val);
  return { getItem:()=>s, setItem:(k,v)=>{s=v;}, removeItem:()=>{s="[]";} }; }
function isC2Unlocked(ls){ try { return JSON.parse(ls.getItem("lailaba_range_v12")||"[]").length >= 12; } catch(e){ return false; } }
// cases: none(LOCKED) · 5/12(LOCKED) · 11/12(LOCKED) · 12/12(UNLOCKED)
Expected: LOCKED for 0/5/11 solved, UNLOCKED only at 12/12.

## Pitfalls
- Different origin breaks everything: keep the sandbox proxied under /api/lab/runtime/* (same
  host:port as the parent). Do NOT point the iframe at http://127.0.0.1:8080/ directly if you
  need C2 gating.
- hidden attr not enough without the display:none CSS rule above.
- Forget to read localStorage on load => if the user solved C1 last session then reopens the
  page, C2 stays locked until they re-trigger postMessage. Always refreshChallengeGating() on
  DOMContentLoaded.
- Counter drift: parent RANGE_TOTAL must equal the iframe total level count (both 12). If you
  add a level to the sandbox, bump both or C2 never unlocks.
- Stale-JS-cache lock: after editing app.js, bump the ?v=N cache-buster on the script tag and
  tell the user to HARD-REFRESH (plain reload may keep the broken copy).
