# Harness pilot implementation evidence

The specification is `studio/docs/HARNESS-ENVIRONMENT-SPEC.md`. This package is the operator workbench; the accepted Studio application remains the presentation foundation. Synthetic SDK execution, live inference, hosted client isolation and production release are separate evidence categories.

## Source baseline

For the 11 September 2026 adaptation slice, the release owner reported the stable Studio staging alias resolved through Vercel metadata to:

- Deployment: `dpl_HT1WJaCRHvEmhH6THdcVHQr6wTZx`
- URL: `https://oceanheart-studio-5h1ppu19d-rick-halletts-projects.vercel.app` (stable alias `https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app`)
- Environment: custom `staging`
- Git source: `f9131bc295243fb0d9d67a38114a5663e0692b6e`, `studio/dev`
- Remote `studio/dev` independently matched that SHA.

The source SHA was refreshed from Git before creating the clean feature worktree. Deployment identity and environment are inherited release-owner metadata, not a fresh provider query or authenticated acceptance by this slice. No website release is included.

## Evidence boundaries

The initial package uses fictional client records and invoice-draft effects. No real-client records, mail access, payment effects or production backend credentials belong in a bench fixture. Keep run state and reports outside Git, even for synthetic work. The application and existing Convex schema/functions are unchanged by the standalone bench; no database migration is required.

The HE-01 through HE-12 acceptance cases remain the full environment checklist. Local provider doubles can establish reconciliation logic but do not establish exe.dev or GitHub integration scope. A deterministic model transport through the real Pi SDK establishes adapter/tool execution but does not measure a hosted model's quality. Production promotion requires approval of a concrete release.

## Implemented local pilot

The package supplies `run`, `eval`, read-only run `inspect`, manifest `plan` and exact-source `export-template` commands. Pi is pinned to 0.85.1, with explicit tool/resource configuration, durable SQLite jobs/draft reservations, bounded runs, cancellation, crash recovery and metadata-only trace export. Provisioning is an injectable controller with a private serialized registry and uncertainty reconciliation; it does not yet have a live exe.dev transport.

The Clara adaptation slice adds `adapt` and exact-prior `rollback`. A reviewed CL-09 effective-date/rate request is evaluated under both configurations across all nine cases using fresh evaluation state and the existing HTML/JSON report. Accepted configuration artifacts and releases are immutable and digest-addressed; a client-scoped atomic pointer selects the runtime version. Live runtime state is deliberately retained, so changing configuration never bypasses an existing draft/session reservation. Failed or stale activation leaves the prior version active, and rollback is limited to the compatible prior configuration. Clean-environment configuration plus SQLite backup/restore remains outstanding.

Clara's eight specified cases run through the actual Pi SDK using the scripted transport. A ninth independent case compares baseline GBP 230 against adapted GBP 240, preserving its historical and negotiated rates. Policies have an explicit practice, session/person scope, effective date and version. No model chooses rate scope. The comparison is local, not the conversational change-and-release journey requested by the full product specification.

Promptfoo 0.123.0 was run with caching and telemetry disabled against the same provider. The direct CLI matrix and Promptfoo each passed 18 case/configuration comparisons. Independent provider calls receive fresh private state directories; CL-08 explicitly repeats one request inside a run. Local trace files are linked from the report. A scripted transport has no inference-provider bill; zero inference cost is labelled as such.

| Spec acceptance | Local evidence and remaining boundary |
| --- | --- |
| HE-01 | Provider-double timeout/crash reconciliation tests; live provider retry still outstanding |
| HE-02 | Run/trace lookup client scope tested; hosted API/backend/repo isolation outstanding |
| HE-03 | Actual Pi restricted tools and disabled discovered resources tested; OS/service isolation outstanding |
| HE-04 | Builder/release-controller boundary not implemented |
| HE-05 | Read-only provider inventory only; provisioned-client port/integration acceptance outstanding |
| HE-06 | Trace exports omit raw model/input data; export rejects secret paths/material; full credential canary acceptance outstanding |
| HE-07 | Credential rotation/revocation/OAuth refresh not implemented |
| HE-08 | Durable local job/draft recovery and replay tested; remote supervisor recovery outstanding |
| HE-09 | Git export verified; scoped clone/push/PR integration not implemented |
| HE-10 | Exact-source export plus local atomic configuration activation/exact-prior rollback; actual application artifact deployment switch outstanding |
| HE-11 | Clara fixed/held-out cases and scoped rate activation demonstrated locally; another-client input stays invariant; hosted second-instance invariance outstanding |
| HE-12 | Off-VM backup and clean-environment restore not implemented |

The existing Studio application exported from the accepted source builds independently without production credentials. No hosted resource was created. Current resource discovery also found disk usage above the account's included allowance and no Node 24/npm in the probed image. Capacity alone does not make the provision plan executable. Resolve the resource budget, secret-free image and live backend/identity/provider adapters before the hosted pilot.
