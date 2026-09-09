# WorkOS practice and task slice

This additive schema introduces `tasks` and optional practice creation receipt fields (`createdBy`, `requestKey`) with indexes. Existing tenant, membership and booking records remain valid. No migration, fixture import, external provider write or hosted deployment is performed by the tests.

## Hosted configuration

Set all six Convex environment variables explicitly: `STUDIO_AUTH_MODE=workos`, `WORKOS_CLIENT_ID=client_YOUR_STAGING_CLIENT_ID`, and empty values for `CLERK_JWT_ISSUER_DOMAIN`, `STUDIO_AUTH_ISSUER`, `STUDIO_AUTH_JWKS`, `STUDIO_AUTH_AUDIENCE`. The frontend uses the same WorkOS client ID and separately owns its API key, cookie secret, redirect URI and Convex URL. Never put the API key or cookie secret in Convex auth config or public environment variables.

The providers follow the [official Convex AuthKit configuration](https://docs.convex.dev/auth/authkit/): client-specific HTTPS JWKS and RS256, with `https://api.workos.com/` plus client audience, and the client-scoped user-management issuer without an audience. Custom WorkOS authentication domains are not supported by this bounded configuration. Confirm the actual staging token's issuer is supported before claiming hosted readiness. [WorkOS sessions](https://workos.com/docs/authkit/sessions) documents the user ID in `sub`; Convex's verified `tokenIdentifier` is the membership key. WorkOS `org_id`, role and permission claims do not grant application membership. Issuer changes require reviewed identity mapping, not automatic account merging.

## Commands

- `tenants.list({})`: authenticated membership-derived `{_id,name,role}[]`.
- `tenants.create({name,requestKey?})`: trimmed name 1–100 characters; optional unpadded nonempty request key at most 128 characters. Live clients should always provide a stable UUID per creation intent and retain it on transport retry. Same creator/key/name returns the existing practice; changed name fails `IDEMPOTENCY_MISMATCH`. Omitted keys preserve the existing explicit create contract.
- `tasks.list({tenantId})`: owner/viewer read, newest first; `{items:[{_id,title,completed,createdAt}],hasMore,limit:200}`. More than 200 tasks is explicitly signalled; cursor pagination is outside this slice. No creator identity or request keys are projected.
- `tasks.create({tenantId,title,requestKey})`: owner only; trimmed single-line title 1–200 characters with no control characters; unpadded nonempty key at most 128 characters. Same tenant/key/creator/title returns the existing task even after completion; changed payload fails `IDEMPOTENCY_MISMATCH`.
- `tasks.setCompleted({tenantId,taskId,completed})`: owner only, checks the task belongs to the selected tenant; sets an explicit boolean and is safe to retry. Concurrent opposite values use transaction order (last committed command wins).

All protected task commands reread membership. A tenant selector never authorizes access. A viewer is a staff reader, not a patient. Tasks are general practice operations: do not enter clinical notes in titles.

## Evidence boundary

Run `npm ci`, `npm run typecheck`, and `npm run test:integration` in `studio/backend`. Tests use a real isolated local Convex backend, ephemeral signed JWTs, independent clients and non-production synthetic input. They verify command persistence, revoked membership, unauthorized and cross-tenant calls, viewer write rejection, validation and request retries, alongside existing booking concurrency and invalid-token checks. Auth configuration unit tests verify WorkOS provider shape and fail-closed configuration. These do not demonstrate WorkOS token issuance, hosted JWKS retrieval, browser login/logout/refresh, or staging database readiness; the integrated staging journey must record those separately.

Verified locally on 2026-09-09: `npm run typecheck` passed; `npm run test:integration` passed 7 unit/lifecycle tests and 23 native-backend checks. The task test sends eight concurrent identical creates through independent HTTP clients and observes one ID; completion, reopening and newest-first ordering persist across fresh clients. Existing booking tests retain 12-way concurrent identical and overlapping request checks. The immutable detailed result is retained under `.local/reports/` in the worker checkout; `.local/last-report.json` provides its current readable result. No hosted acceptance is claimed.

## Safe deployment transition

An old deployed auth-policy version cannot understand `workos`; setting that mode before deploying compatible code correctly rejects configuration. First add `WORKOS_CLIENT_ID` with an empty value while retaining the old selected provider and its existing values. Deploy this reviewed code, which supports both the old provider and WorkOS. Then prepare a private environment file containing all six values for WorkOS and apply it atomically with `convex env set --from-file <private-file> --force` against the explicitly selected staging deployment. WorkOS mode must be paired with its client ID and four empty legacy provider values in the same update. Never print that file or rely on sequential provider changes that temporarily mix incompatible settings. Confirm deployed authentication config and affected hosted requests afterward. Production is outside this authorization.

## Explicit hosted acceptance runner

`scripts/hosted-acceptance.mjs` is separate from CI and was prepared without executing provider mutations. It targets only `https://charming-albatross-632.convex.cloud`, WorkOS staging environment `environment_01M22XATA8QP8R896NV5511N1V` and its public client ID. An operator must supply `STUDIO_STAGING_CONVEX_URL`, `STUDIO_ACCEPTANCE_ENVIRONMENT`, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY` (a staging `sk_test_` key), and `STUDIO_ALLOW_SYNTHETIC_FIXTURES=yes` through a private environment loader. From `studio/backend`, run:

```sh
node scripts/hosted-acceptance.mjs
```

Do not paste the API key into shell command text or commit a fixture environment file. The runner creates exactly three unique synthetic accounts using unique reserved `studio-rad-<run UUID>.example.com` subdomain emails with generated passwords. It explicitly marks these authorized test fixtures `email_verified` during creation; this does not prove real-user email ownership or test email verification. It sends no invitations or email-verification requests. WorkOS may still enforce provider challenges; failures stop without retries or challenge bypass. If the account creation response is lost, inspect the provider dashboard for the recorded unique email before repeating anything.

The runner uses [WorkOS create user](https://workos.com/docs/reference/authkit/user/create) and the documented [password authentication grant](https://workos.com/docs/reference/authkit/authentication), validates the issued token using the real client JWKS, then exercises hosted Convex using that token (no admin identity override). Expected provider/Convex assertion failures are sanitized so token material cannot enter terminal output.

Evidence goes to a new OS temporary directory `studio-staging-acceptance-*` with permissions 0700. `credentials.json` and `report.json` are 0600 and are outside the repository. Credentials contain `accounts` with roles `owner`, `outsider`, `viewer`, email, password and user ID through an explicit allowlist. Access tokens, refresh tokens, identity claims and the API key remain in process memory and are never persisted. The report retains exact synthetic provider/database IDs for backend fixture cleanup. The browser runner creates its own practice/task and records their actual IDs separately; this runner creates no additional browser fixture. Read only the email/password fields needed for browser sign-in, without printing the file. These temporary files are intentionally private and ephemeral; preserve them securely if acceptance must span a restart.

After browser acceptance, use the recorded exact IDs for a reviewed staging cleanup: delete the three synthetic WorkOS users (revoking their access), and remove only their synthetic tasks, memberships and practices from the staging database. This script does not implement blanket deletion or automatic cleanup; retain the evidence until the integrated check is recorded, then securely remove private credential artifacts. Backend API acceptance is distinct from browser login, callback, logout and reload acceptance.

An initial operator-run fixture at the bare `example.com` domain encountered WorkOS `sso_required` on password authentication. New runs use a unique synthetic subdomain to avoid an unrelated shared-domain connection policy. This is test-fixture isolation, not a change to WorkOS security settings or a bypass for an existing user. The runner stops on any remaining SSO requirement or challenge, recording only the safe provider `code`/`error` field. It intentionally does not retry or resume partially created users; before a new run, inspect the prior report and remove only the recorded failed synthetic user through reviewed staging cleanup.

## RIC-104 / RIC-105: services and contact creation

Additive tables `services` and `clients` each have tenant and tenant/request-key indexes. There is no migration, seed import, booking linkage, editing, publication or archive operation.

`services.create({tenantId,name,durationMinutes,priceMinor,currency:"GBP",description?,requestKey})` returns the service ID. Only owners create; current members read. Names are trimmed, 1–100 characters and reject control characters. Duration is an integer 1–1440 minutes. Price is an integer 0–100000000 minor units (GBP pence). Optional description is trimmed and at most 2000 characters. New services have `active:true`; this field does not establish website publication or booking availability.

`clients.create({tenantId,name,email?,phone?,requestKey})` returns the contact ID. **Only owners may read or create client contacts.** Names follow the same validation. Optional email is trimmed, at most 254 characters with basic syntax validation; optional phone is trimmed and at most 40 characters. Contact fields reject control characters. Blank optional fields are omitted. Email case is preserved; no identity or uniqueness is inferred from contact email. No notes, history, status or clinical data fields exist in this increment.

Both `list({tenantId,paginationOpts:{numItems,cursor}})` commands use native Convex pagination. Request 1–50 items with null initial cursor; results contain `page`, `isDone`, `continueCursor` and Convex pagination metadata. Order is newest first. Services expose only ID, name, duration, price, currency, optional description, active and creation time. Clients expose only ID, name, optional contact fields and creation time. Neither exposes creator identities or retry keys. Reset pagination when selecting another practice. Public/client-facing APIs are not implemented.

Creation request keys are nonempty unpadded strings at most 128 characters. Identical normalized payload and creator with the same tenant/key returns the original ID; changed normalized payload fails `IDEMPOTENCY_MISMATCH`. All commands recheck membership. Fields deliberately remain separate from browser demo models and future booking snapshots.

Local integration now invokes shared `scripts/catalog-checks.mjs` against the native backend: unauthenticated and cross-tenant reads/writes, owner-only contact privacy, viewer service reads, viewer write denial, revocation, six concurrent retries per table, normalized payload idempotency, validation, projections, fresh-client persistence and cursor traversal. Existing booking and auth checks remain included.

For root-operated hosted acceptance, set the same explicit staging environment gates as above plus `STUDIO_EXISTING_CREDENTIALS` to the private existing fixture's absolute path, then run `node scripts/hosted-catalog-acceptance.mjs`. It requires existing synthetic owner/outsider/viewer accounts and existing distinct owner practices. It never creates WorkOS users or practices, does not persist session tokens or duplicate passwords, and makes no provider settings changes. Password grants authenticate the recorded user IDs; real JWKS verification precedes the same catalogue checks. A new private report directory records each created service/contact ID and tenant for exact cleanup. Fixture failures/challenges stop without retry. The original broad acceptance runner remains available separately; it is not the next-slice runner.
