# Commons Prototype Dependency Handoff

Date: 2026-07-01
Repo: `rickhallett/oceanheart`
Default branch: `main`
Target checkout: `/Users/mrkai/code/sites/oceanheart`

## Summary

The commons work is not a straight three-branch stack. The three prototype
worktrees are sibling checkpoints, all based on `3ba4cdb` (`feat(site): Refresh
Oceanheart portfolio surfaces`). Merge the portfolio refresh first, then choose
one commons prototype for the public surface unless a separate integration slice
namespaces CSS and consolidates navigation.

Each prototype builds cleanly on its own. They are not safe to merge together
as-is because they overlap in `hugo.toml`, `layouts/partials/head.html`, and
`static/css/oceanheart.css`; the CSS also has selector collisions such as
`.commons-*`, `.map-node`, and `.map-line`.

## Included Issue IDs

No GitHub issue IDs are currently attached to this packet.

Evidence:

- `gh issue list --state all --limit 100 --json ...` returned `[]`.
- `gh pr list --state all --limit 50 --json ...` returned `[]`.

Until issues are created, use the branch and commit IDs below as the operational
handoff IDs.

## Included Worktree Checkpoints

| Work ID | Worktree | Branch | Head | Route | Role |
| --- | --- | --- | --- | --- | --- |
| BASE | `/Users/mrkai/code/sites/oceanheart` | `rickhallett/feat/oceanheart-portfolio-refresh` | `3ba4cdb` | site-wide | Required parent surface refresh |
| V0 | `/Users/mrkai/code/sites/oceanheart-worktrees/v0-local-circle` | `rickhallett/feat/commons-v0-local-circle` | `d75528c` | `/commons/` | Local Dorset practice commons MVP |
| V1 | `/Users/mrkai/code/sites/oceanheart-worktrees/v1-experience-map` | `rickhallett/feat/commons-v1-experience-map` | `b04843a` | `/experience-map/` | Interactive privacy-conscious experience map |
| V2 | `/Users/mrkai/code/sites/oceanheart-worktrees/v2-global-commons` | `rickhallett/feat/commons-v2-global-commons` | `68aec4c` | `/global-commons/` | Global commons network prototype |

## Excluded Checkpoints

No separate external checkpoint IDs were found in the repo or GitHub metadata.
These local surfaces are explicitly excluded from this merge packet:

- `.DS_Store` in the base checkout.
- Untracked `jobs/` career-prep artifacts in the base checkout.
- `data/decisions.json` / `content/decisions/sd-*.md` session-decision content;
  no SD ID is being used as the source of truth for this commons merge.
- Private evidence files referenced from prototype docs under `/tmp/...`; they
  can support internal reasoning, but they are not durable verification inputs.

Selection-dependent exclusions:

- If V0 ships first, V1 (`b04843a`) and V2 (`68aec4c`) should be parked as
  excluded sibling checkpoints until integration work namespaces their CSS.
- If V1 ships first, V0 (`d75528c`) and V2 (`68aec4c`) should be parked.
- If V2 ships first, V0 (`d75528c`) and V1 (`b04843a`) should be parked.

## Dependency Graph

```text
main / origin/main
  ed33805 feat(site): Refresh job search profile
    |
    v
BASE
  3ba4cdb feat(site): Refresh Oceanheart portfolio surfaces
    |
    +-- V0 d75528c Practice Commons Dorset
    +-- V1 b04843a Experience Map
    +-- V2 68aec4c Global Commons
```

Hard dependency:

- V0, V1, and V2 all depend on BASE.

Shared changes:

- All three prototypes add the same `noAnalytics` guard around PostHog in
  `layouts/partials/head.html`.
- All three add a new primary navigation item in `hugo.toml`, but with competing
  labels and routes.
- All three append substantial page-specific CSS to `static/css/oceanheart.css`.

Conflict risks:

- `hugo.toml`: same nav insertion point, competing weight `20`, duplicate
  "commons" labels between V0 and V2.
- `layouts/partials/head.html`: identical analytics guard, should land once.
- `static/css/oceanheart.css`: selector collisions across prototypes. V0 and V2
  both use broad `.commons-*`; V1 also uses broad `.map-node` / `.map-line`.

## Worktree Grouping

### Group A: Base Portfolio Refresh

Branch: `rickhallett/feat/oceanheart-portfolio-refresh`

Purpose: establishes the refreshed Oceanheart portfolio surface. This is the
parent for all three commons prototypes.

Merge status: prerequisite.

Gate before merging descendants:

- Base branch merged or rebased onto `main`.
- Base checkout has no accidental `.DS_Store` or unrelated `jobs/` staging.

### Group B: Local Commons

Branch: `rickhallett/feat/commons-v0-local-circle`

Files:

- `content/commons/_index.md`
- `docs/agentic-projects/v0-local-circle.md`
- `layouts/commons/list.html`
- `hugo.toml`
- `layouts/index.html`
- `layouts/partials/head.html`
- `static/css/oceanheart.css`

Use when the product decision is: start local, Dorset first, gathering before
platform.

### Group C: Experience Map

Branch: `rickhallett/feat/commons-v1-experience-map`

Files:

- `content/experience-map.md`
- `docs/agentic-projects/v1-experience-map.md`
- `layouts/_default/experience-map.html`
- `static/js/experience-map.js`
- `hugo.toml`
- `layouts/partials/head.html`
- `static/css/oceanheart.css`

Use when the product decision is: prove the interaction model for anonymised
experience navigation.

### Group D: Global Commons

Branch: `rickhallett/feat/commons-v2-global-commons`

Files:

- `content/global-commons.md`
- `docs/agentic-projects/v2-global-commons.md`
- `layouts/_default/global-commons.html`
- `hugo.toml`
- `layouts/partials/head.html`
- `static/css/oceanheart.css`

Use when the product decision is: show the larger network thesis and chapter
model.

## Recommended Merge Order

1. Merge BASE into `main`.

   This is the required parent commit. Do not include `.DS_Store` or untracked
   `jobs/` files in that merge unless a separate career-prep commit is intended.

2. Choose one prototype checkpoint to ship.

   Low-risk public path: merge exactly one of V0, V1, or V2 after BASE. Each
   branch is a complete one-commit MVP and builds independently.

3. If more than one prototype must ship, create an integration branch from the
   updated `main` before merging the second prototype.

   Required integration work:

   - Keep the PostHog `noAnalytics` guard once.
   - Consolidate nav into deliberate labels and weights.
   - Namespace page CSS before combining branches. Suggested direction:
     `practice-commons-*` for V0, `experience-map-*` for V1, and
     `global-commons-*` for V2.
   - Rename broad shared selectors like `.map-node` and `.map-line` so one page
     cannot restyle another.

4. Re-run local and deploy verification after the final merge, not just on the
   source branches.

## Verification Gates

Already run against isolated worktrees:

```text
V0: hugo --destination /tmp/oceanheart-v0-public --cleanDestinationDir --cacheDir /tmp/oceanheart-v0-cache
    PASS: 468 pages, 7 static files

V1: hugo --destination /tmp/oceanheart-v1-public --cleanDestinationDir --cacheDir /tmp/oceanheart-v1-cache
    PASS: 467 pages, 8 static files

V2: hugo --destination /tmp/oceanheart-v2-public --cleanDestinationDir --cacheDir /tmp/oceanheart-v2-cache
    PASS: 467 pages, 7 static files
```

Required after integration:

```text
git status --short --branch
hugo --destination /tmp/oceanheart-merged-public --cleanDestinationDir --cacheDir /tmp/oceanheart-merged-cache
```

Manual smoke checks:

- Nav shows only the intended public entries.
- The selected route renders:
  - V0: `/commons/`
  - V1: `/experience-map/`
  - V2: `/global-commons/`
- Mobile layout does not overflow on the selected route.
- PostHog still loads on normal pages.
- Pages with `noAnalytics = true`, if any are added later, omit PostHog.
- If multiple prototypes are merged, each route keeps its own visual system and
  no selector bleed is visible.

Deploy gate:

- Upgrade the Vercel CLI before relying on Vercel-local verification. Current
  session context reports `vercel` is outdated: `54.14.2 -> 54.18.6`.
- Then run the repo's Vercel build gate for the final integration branch.

## Open Decisions

1. Which public product story should ship first: local practice commons,
   interactive experience map, or global commons?
2. Should `docs/agentic-projects/*.md` remain internal handoff docs, or should
   any part of them become public content?
3. Should the `/tmp/...` evidence references in V0 and V2 docs be replaced with
   a durable, privacy-preserving evidence summary before merge?
4. If more than one prototype ships, should the nav expose all routes or keep
   secondary routes unlinked until the product direction is settled?

## Practical Recommendation

Treat BASE as required, then merge one prototype. If the goal is immediate public
traction, V0 is the cleanest story: local seed, clear invitation, and least
conceptual abstraction. Keep V1 and V2 as parked checkpoints until there is a
deliberate integration pass for CSS namespacing and nav design.
