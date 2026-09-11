# Harness pilot implementation evidence

The specification is `studio/docs/HARNESS-ENVIRONMENT-SPEC.md`. This package is the operator workbench; the accepted Studio application remains the presentation foundation. Synthetic SDK execution, live inference, hosted client isolation and production release are separate evidence categories.

## Source baseline

For the 11 September 2026 recovery slice, the stable Studio staging alias resolved through Vercel metadata to:

- Deployment: `dpl_7K3QP6tJoYGf9RU3dQagiUUGT84u`
- URL: `https://oceanheart-studio-nmtu47kit-rick-halletts-projects.vercel.app` (stable alias `https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app`)
- Environment: custom `staging`
- Git source: `4623380ce496bed9388b6e9ca5db1f60b9495c24`, `studio/dev`
- Remote `studio/dev` independently matched that SHA.

The source SHA was refreshed from Git before creating the clean feature worktree. Provider metadata was refreshed for deployment identity, URL, environment and READY state, and the stable `/app` route returned HTTP 200. That metadata did not expose a Git SHA, so source attribution remains the accepted release receipt corroborated by the matching remote head; this is not authenticated practitioner acceptance. No website release is included.

## Evidence boundaries

The initial package uses fictional client records and invoice-draft effects. No real-client records, mail access, payment effects or production backend credentials belong in a bench fixture. Keep run state and reports outside Git, even for synthetic work. The application and existing Convex schema/functions are unchanged by the standalone bench; no database migration is required.

The HE-01 through HE-12 acceptance cases remain the full environment checklist. Local provider doubles can establish reconciliation logic but do not establish exe.dev or GitHub integration scope. A deterministic model transport through the real Pi SDK establishes adapter/tool execution but does not measure a hosted model's quality. Production promotion requires approval of a concrete release.

## Implemented local pilot

The package supplies `run`, `eval`, read-only run `inspect`, manifest `plan` and exact-source `export-template` commands. Pi is pinned to 0.85.1, with explicit tool/resource configuration, durable SQLite jobs/draft reservations, bounded runs, cancellation, crash recovery and metadata-only trace export. Provisioning is an injectable controller with a private serialized registry and uncertainty reconciliation; it does not yet have a live exe.dev transport.

The Clara adaptation slice adds `adapt` and exact-prior `rollback`. A reviewed CL-09 effective-date/rate request is evaluated under both configurations across all nine cases using fresh evaluation state and the existing HTML/JSON report. Accepted configuration artifacts and releases are immutable and digest-addressed; a client-scoped atomic pointer selects the runtime version. Live runtime state is deliberately retained, so changing configuration never bypasses an existing draft/session reservation. Failed or stale activation leaves the prior version active, and rollback is limited to the compatible prior configuration. HE-12 now preserves and validates that activation history through a clean restore.

The HE-10 application lane now packages a source-verified standalone Studio artifact and switches it through a stable private loopback router only after manifest identity and application health checks. Its client-scoped fsync-backed pointer is independent of Clara configuration and durable workflow state. Local process/HTTP evidence covers prior-serving-on-failure, exact reported source/digest/data target, compatible exact-prior rollback and owned-process shutdown. HE-12 binds any recorded active/prior application release to its verified manifest fields and can require the intended schema/data target at restore; immutable application payload recovery and private-VM app serving remain separate operator steps.

Clara's eight specified cases run through the actual Pi SDK using the scripted transport. A ninth independent case compares baseline GBP 230 against adapted GBP 240, preserving its historical and negotiated rates. Policies have an explicit practice, session/person scope, effective date and version. No model chooses rate scope. The comparison is local, not the conversational change-and-release journey requested by the full product specification.

Promptfoo 0.123.0 was run with caching and telemetry disabled against the same provider. The direct CLI matrix and Promptfoo each passed 18 case/configuration comparisons. Independent provider calls receive fresh private state directories; CL-08 explicitly repeats one request inside a run. Local trace files are linked from the report. A scripted transport has no inference-provider bill; zero inference cost is labelled as such.

| Spec acceptance | Local evidence and remaining boundary |
| --- | --- |
| HE-01 | Provider-double timeout/crash reconciliation tests; live provider retry still outstanding |
| HE-02 | Run/trace lookup client scope tested; hosted API/backend/repo isolation outstanding |
| HE-03 | Actual Pi restricted tools and disabled discovered resources tested; OS/service isolation outstanding |
| HE-04 | Clean private builder uses a distinct unprivileged service account and built the exact Studio export without credentials; a deploy-controller boundary remains outstanding |
| HE-05 | Three clean operator-only guests and private proxy state inspected; dedicated backend/identity and credential-canary acceptance remain outstanding |
| HE-06 | Trace exports omit raw model/input data; export rejects secret paths/material; full credential canary acceptance outstanding |
| HE-07 | Credential rotation/revocation/OAuth refresh not implemented |
| HE-08 | Durable local recovery plus remote supervisor stop/restart/replay preserved one synthetic draft and one job/effect/reservation; VM-boot reinstallation remains operator-owned |
| HE-09 | Git export verified; scoped clone/push/PR integration not implemented |
| HE-10 | Local standalone Studio process switch: verified source/digest/data target, candidate health before atomic pointer, prior serving through failure, and exact compatible rollback. Private-VM deployment remains outstanding |
| HE-11 | Clara fixed/held-out cases and scoped rate activation demonstrated locally; another-client input stays invariant; hosted second-instance invariance outstanding |
| HE-12 | AES-256-GCM off-VM archive restored on the other clean runtime host with matching client/backup/content/archive digests and one job/effect/reservation. Replaying the completed request retained the original 22-event trace and did not invoke a new effect. Local tests cover live WAL copying, active Clara config + rollback, HE-10 release identity/compatibility, corruption, wrong-client/incompatible targets and refusal to overwrite existing state |

The existing Studio application exported from infrastructure candidate `2c81ee8ab6c19cf0e6a61d5592de96f3e675e0dd` built independently on the clean private builder without production credentials. Two clean runtime guests independently ran the pinned Pi synthetic CLI; a third clean guest completed the build. Current provider inspection reported 65.8 GiB used of 100 GiB pooled disk across 11 private guests, with no overage. These are operator-only synthetic hosts, not practitioner-ready instances. The HE-12 proof used the two existing runtime guests and created no VM. Capacity and recovery proof do not establish a dedicated backend, identity, credential resolver or private-VM application deployment.

## Dedicated backend and identity boundary

The current manifest accepts only client-scoped `synthetic://<clientId>/...` backend and retrieval references. `ProvisionProvider` is injectable but has no live Convex or WorkOS adapter, and the accepted Studio staging backend remains shared rather than a dedicated client target. Placeholder values in `.env.example` are not configuration evidence.

The next implementation boundary is a controller-only typed adapter which inspects or creates an explicitly synthetic backend and identity environment, returns provider-controlled IDs, and persists the exact environment/client binding in the private registry. Acceptance must map server authorization to that client, prove a second client cannot read or mutate it, and reconcile uncertain provider effects before retry. Manifests and receipts may contain secret references but never credential values. No backend or identity account was provisioned by HE-12.
