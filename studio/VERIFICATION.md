# Studio verification and preview isolation

Run from `studio/` with Node 24:

```sh
npm ci
npx playwright install chromium
npm run verify
```

`verify` builds the production Next.js app, checks TypeScript (including generated
route types), then tests the production server using desktop and mobile Chromium.
Each test receives a fresh browser context. The persistence test demonstrates
navigation/reload behaviour and browser-local prototype isolation. It does not
claim backend persistence, authentication or tenant isolation.

`npm run test:e2e` reuses the existing build. `npm run test:e2e:report` opens the
report. Failed runs retain traces and screenshots. CI stores failure evidence for
seven days. Only synthetic sample data belongs in this suite or its artifacts.

## Independent worktrees

Every worktree has its own `node_modules`, `.next`, report and test output.
Use a distinct `STUDIO_TEST_PORT` for concurrently running worktrees, for example
`STUDIO_TEST_PORT=3211 npm run verify`. The harness starts its own loopback server
and refuses to reuse an occupied port. It cannot be configured to target the
production website. Tests do not send messages or make provider payments.

## Pull requests and previews

The `Studio verification` workflow runs for Studio changes on pull requests and
relevant branch pushes. It uses read-only repository permissions, no persisted
checkout credentials, no deployment credentials, no cloud OIDC token and no
production secrets. Do not replace `pull_request` with `pull_request_target` to
execute contributed code. A production build inside the CI runner is the isolated
preview under test; this workflow does not create a public Vercel deployment.

Vercel preview deployments, if enabled in project settings, must use preview-only
environment variables and synthetic data. Once a backend exists, give every
preview a disposable deployment/database or isolated namespace, distinct from
production. Use provider sandbox identities for Stripe/Shopify and dedicated
queues, storage prefixes and trace tags. A Git worktree alone does not isolate
remote resources. No cloud preview resources are provisioned by this change.

Production deployment should require a successful verification check on the same
commit. Repository branch protection and Vercel environment configuration are
external settings and must be verified separately; this file does not enforce
them. Path-filtered checks should not be made universally required on unrelated
repository pull requests without a corresponding always-running gate.

## Extending the gate

Add each new user journey and its failure cases with the feature. Backend work
needs independent authorisation, concurrent-update and retry checks; provider
adapters need sandbox contract tests. Add those commands to `verify` when the
corresponding modules exist. Never make production credentials a prerequisite
for untrusted pull-request verification.
