# Dashboard web build failure — rolldown native binding (Termux/Android)

## Error transcript (truncated from `lailaba dashboard --no-open` log)
```
> web@0.0.0 build
> tsc -b && vite build
...
    		const error = /* @__PURE__ */ new Error("Cannot find native binding.
    npm has a bug related to optional dependencies
    (https://github.com/npm/cli/issues/4828). Please try `npm i`
    again after removing both package-lock.json and node_modules directory.");
    Error: Cannot find native binding. npm has a bug related to optional
    dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i`
    again after removing both package-lock.json and node_modules directory.
        at requireNative (file:///.../rolldown/dist/shared/binding-Dh6LYCIB.mjs:113:12)
        at file:///.../rolldown/dist/shared/binding-Dh6LYCIB.mjs:475:18 {
          code: 'MODULE_NOT_FOUND',
          requireStack: [ '.../rolldown/dist/shared/binding-Dh6LYCIB.mjs' ]
        }
    Node.js v26.3.1
    npm error Lifecycle script `build` failed with error:
    npm error code 1
    npm error command failed
    npm error command sh -c tsc -b && vite build
```

## Root cause
npm's optional-dependency resolver (bug #4828) does not reliably install the
platform-specific `@rolldown/binding-*` native package on Termux. Vite
(rolldown-based) then cannot load its native module and the build aborts, so
the dashboard server never binds port 9119 (curl stays `000`; `--status`
eventually reports "No lailaba dashboard processes running").

## Reproduction
1. Fresh Termux install or moved/partial `node_modules` (corrupt binding).
2. `lailaba dashboard` with no prebuilt `dist/`.
3. Watch log -> build error above; `curl :9119` stays `000`.

## Fix recipe
```
cd ~/.hermes/hermes-agent/web
rm -f package-lock.json
rm -rf node_modules
npm install                # on Termux, add --include=optional if rolldown skipped
npm run build              # slow: 1-3 min; confirm tsc + vite succeed
lailaba dashboard --no-open
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9119/   # expect 200
```

## Cleanup after a failed / stuck build
If you killed the dashboard, also reap orphaned build children (they survive
the server kill and keep burning CPU):
```
pkill -f "npm run build"; pkill -f "vite build"; pkill -f "tsc -b"
ps aux | grep -E "npm run build|vite|tsc -b" | grep -v grep   # expect none
```

## What is safe to delete vs keep
- DELETE (regenerable): `node_modules/`, `package-lock.json`, `dist/`.
- KEEP (source): `src/`, `public/`, `package.json`, `index.html`,
  `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `README.md`,
  `eslint.config.js`.
