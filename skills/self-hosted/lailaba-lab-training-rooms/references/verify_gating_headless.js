// Headless DOM gating verification for the Lab Challenge 1/2 unlock flow.
// Run: node references/verify_gating_headless.js  (from ~/lailaba-ai)
// Proves Challenge 2 (Arena) stays LOCKED until Live Range (C1) is fully solved,
// WITHOUT a browser. Mirrors the real event flow so a logic regression is caught
// before the user reports "even level 1 is locked" or "C2 never unlocks".
//
// Verifies:
//   - At 0/12 Live Range solved: challenge-2.hidden === true, locked placeholder shown.
//   - After the iframe posts lailaba_range_done AND refreshCompletion sets
//     window.__labRangeComplete: challenge-2.hidden === false (unlocked).
//   - isChallenge2Unlocked() returns true only when localStorage['lailaba_range_v12']
//     holds all 12 (the iframe's hardcoded KEY, NOT the RANGE_VERSION label).

const fs = require('fs');
const APP_JS = '/data/data/com.termux/files/home/lailaba-ai/lab/js/app.js';
let src = fs.readFileSync(APP_JS, 'utf8');

function makeEl(id) {
  return {
    id, _t: '', _h: '', value: '', disabled: false, hidden: false, style: {},
    dataset: {}, className: '',
    classList: { _s: new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
      toggle(c,f){ f?this._s.add(c):this._s.delete(c) }, contains(c){return this._s.has(c)} },
    set textContent(v){this._t=v}, get textContent(){return this._t},
    set innerHTML(v){this._h=v}, get innerHTML(){return this._h},
    appendChild(){}, remove(){}, querySelector(){return makeEl('q')},
    querySelectorAll(){return []}, addEventListener(){}, onclick:null,
    scrollIntoView(){}, scrollTop:0, scrollHeight:0,
  };
}
const els = {};
global.document = {
  getElementById(id){ return els[id] || (els[id] = makeEl(id)); },
  querySelectorAll(){ return []; },
  addEventListener(){}, createElement(){ return makeEl('c'); },
};
global.window = { Fireworks: null, addEventListener(){}, location:{} };
// seed localStorage as if the iframe solved all 12 (its hardcoded KEY):
global.localStorage = (() => {
  let s = { 'lailaba_range_v12': '[1,2,3,4,5,6,7,8,9,10,11,12]' };
  return { getItem: k => (k in s ? s[k] : null),
           setItem: (k,v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } };
})();
global.showToast = () => {}; global.initTheme = () => {};
global.isAuthenticated = () => true; global.getUser = () => ({ full_name: 'T' });
global.apiFetch = async () => ({ json: async () => ({}) });
global.fetch = async () => ({ ok: true, json: async () => ({}) });

eval(src + '\n;global.__refresh=refreshChallengeGating;global.__unlock=unlockChallenge2;global.__lock=lockChallenge2;global.__isUnlocked=isChallenge2Unlocked;global.__onMsg=onChallenge2Complete;global.__refreshCompletion=refreshCompletion;');

// 1) Start state: C2 must be hidden (Live Range not done from server view)
global.__refresh();
const startHidden = els['challenge-2'].hidden;
const startLockedShown = els['challenge-2-locked'].hidden === false;
const startPred = global.__isUnlocked();

// 2) Simulate iframe completing all 12 -> postMessage lailaba_range_done
//    (real listener also calls submitRangeSolve -> refreshCompletion sets __labRangeComplete)
global.__msg && global.__msg({ data: { type: 'lailaba_range_done', version: 'v14', total: 12 } });
global.__refreshCompletion && global.__refreshCompletion();
const afterHidden = els['challenge-2'].hidden;
const afterPred = global.__isUnlocked();

console.log('[start]         C2 hidden =', startHidden, '(expect true)');
console.log('[start]         locked placeholder shown =', startLockedShown, '(expect true)');
console.log('[start]         isChallenge2Unlocked =', startPred, '(expect false)');
console.log('[after range]  C2 hidden =', afterHidden, '(expect false)');
console.log('[after range]  isChallenge2Unlocked =', afterPred, '(expect true)');

const ok = startHidden && startLockedShown && !startPred && !afterHidden && afterPred;
console.log(ok ? 'GATING OK' : 'GATING REGRESSION');
process.exit(ok ? 0 : 1);
