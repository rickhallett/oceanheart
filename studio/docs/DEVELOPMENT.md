# Studio development and release

## Current source of truth

Accepted UI: Precision, promoted on 9 September 2026.

- Repository: `rickhallett/oceanheart`, application directory `studio/`.
- Development branch: `studio/dev`.
- Canonical Mac checkout: `/Users/oai/work/oceanheart/studio-dev/studio`.
- Local development URL: `http://127.0.0.1:4331/app`.
- Design authority: [STYLE_GUIDE.md](STYLE_GUIDE.md).
- Feature sequence: [RAD-ROADMAP.md](RAD-ROADMAP.md).

The unrelated historic local branch `dev` is preserved. Do not confuse it with `studio/dev`.

## Environment model

| Environment | Role | Status |
| --- | --- | --- |
| Development | `studio/dev`, local server, fictional fixtures | Canonical accepted UI |
| Preview | Feature PR build targeting `studio/dev`; fictional fixtures or isolated provider data | Vercel Git previews available; candidates until CI and acceptance pass |
| Staging | `studio/dev`; custom Vercel staging environment with isolated provider data | Branch mapping configured; next deployment needs environment/SHA acceptance |
| Production | `main`, existing Studio Vercel project | Unchanged by this promotion |

Production project is verified as `oceanheart-studio`, root directory `studio`, Node.js 24, production branch `main`. Automatic custom-domain assignment is disabled for manual promotion. See the staging policy for the dated provider checkpoint. Do not infer live deployment state from local folder names. Before a production release, verify Vercel's Git branch, root directory, environment variables and deployed SHA. No production deployment is part of this development promotion.

## Daily workflow

Start feature branches from updated `studio/dev`. Deliver one complete user journey per PR, targeting `studio/dev`. Use the style guide and keep demo fixtures separate from live records. Review browser evidence and CI before merging. Release from `studio/dev` to `main` through a reviewed PR; never treat pushing development as production approval.

Follow [STAGING-AND-RELEASE.md](STAGING-AND-RELEASE.md) for CI, staging acceptance, CodeRabbit review cadence and the explicit production approval boundary.

```sh
npm ci
STUDIO_PREVIEW=1 npm run dev -- --hostname 127.0.0.1 --port 4331
```

Preview compilation lives in `.next-preview`, leaving production `.next` available for verification. Independent installs replace the experiment's shared dependency symlink.

```sh
npx next build --webpack
npm run typecheck
STUDIO_TEST_PORT=4340 npm run test:e2e
```

CI checks development pushes and pull requests. Existing `npm run verify` also regenerates Chakra types before building; run that only with this checkout's own dependencies.

## Acceptance boundary

The UI is accepted as the baseline for this stage. `/app` remains a local prototype. The independent backend has a tenant-scoped booking slice; identity, hosted configuration and migration of the reviewed workspace to explicit server commands remain separate work. No automatic upload of browser sample data is authorised or designed.

Promotion validation: optimized production build passed; 52 browser cases passed on the first run, with the two remaining cases passing after obsolete style assertions were aligned with reviewed 13px controls, 34px height and 6px dialog-button radius. No backend code was changed or backend suite rerun in this promotion.
