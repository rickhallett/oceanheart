<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Workspace design

Before changing `/app` UI, read [the canonical style guide](docs/STYLE_GUIDE.md). It supersedes the initial Precision proposal and historical CSS defaults. Preserve the reviewed white, borderless workspace and compact control scale. Verify visible results at the affected viewport.

## Database readiness

For every significant Studio update deployed to development/staging or production:

- Confirm the application's target database belongs to the intended environment. Check that its deployed schema, backend functions and indexes are current and ready for the application revision, including required migrations, seed data and configuration where applicable.
- Identify required database changes before deployment. Apply only reviewed changes within the authorised deployment scope; never blindly migrate, reset data, copy production data into staging or import browser sample data.
- After deployment, verify compatibility through the affected application's hosted data journey and record the app revision, database target and check results. Report missing configuration or access as an unverified readiness check; a build or browser-local prototype does not demonstrate database readiness. For changes with no database impact, explicitly record `No database impact` and the reason.

Follow the [staging and release policy](docs/STAGING-AND-RELEASE.md): development pushes deploy to staging automatically; production releases and their database changes require explicit approval for the concrete release.

## Linear tracking

Keep the [Oceanheart Studio Linear project](https://linear.app/tinyrick/project/oceanheart-studio-8ed48b4b1722) in sync with the work:

- Before starting, find and reuse the relevant issue; create one only when no suitable issue exists. Keep its scope, acceptance criteria and responsible owner or worker clear and current.
- Update the issue when work starts, becomes blocked, enters review or completes. Record concrete blockers and the next action; link the PR/commit, relevant staging evidence and database readiness result (including a reasoned `No database impact` when applicable).
- Distinguish implementation, merge, staging acceptance and production release in status notes. Mark `Done` only when the issue's acceptance criteria are demonstrated, following the [delivery evidence contract](docs/DELIVERY.md#verification-and-reporting); an implemented or merged change alone does not prove staging acceptance or an approved production release.
