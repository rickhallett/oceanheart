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
