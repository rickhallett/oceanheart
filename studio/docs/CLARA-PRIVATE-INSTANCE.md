# Private Clara invoice preparation

The dedicated Clara mode reuses Studio's existing `/app` route, WorkOS sign-in and Precision shell. It is disabled unless `STUDIO_PRIVATE_WORKFLOW=clara`, a valid `STUDIO_CLARA_RUNTIME_URL`, and the existing WorkOS server settings are all present. Shared staging and production therefore keep their existing practice workspace. This mode does not create a tenant, select a default real practice or mount the public browser demo.

The page is explicitly a fictional demonstration. Its immutable September ledger covers an attended session, a policy-backed cancellation and a prepaid session. Preparing creates only an invoice draft; it cannot send an invoice, contact a client or collect payment. The browser stores only the opaque run ID so reload can inspect the same durable result.

## App to runtime contract

The browser can call only the same-origin `POST /api/private/clara` route with one of:

```json
{"operation":"prepare"}
{"operation":"run","runId":"UUID"}
{"operation":"draft","runId":"UUID"}
{"operation":"trace","runId":"UUID"}
```

The route rejects unexpected fields, bodies over 4 KiB, cross-origin requests and missing WorkOS sessions before contacting the runtime. It obtains the current access token from AuthKit rather than accepting an authorization value from the browser body. The prepare request is expanded server-side to the fixed fictional input and an actor-stable idempotency key. The browser never supplies a client ID, environment, subject, amount or policy.

The route sends `POST` to the exact configured `/v1/clara` endpoint with `Authorization: Bearer <WorkOS access JWT>` and one of:

```ts
{ schemaVersion: 1, operation: "start", idempotencyKey, input }
{ schemaVersion: 1, operation: "run" | "draft" | "trace", runId }
```

Gates' Node runtime bridge must pass every call through the concrete JWT verifier, controller subject registry, exact dedicated environment/client binding and bound durable runtime. Start and all three reads reauthorize independently. It must not trust the idempotency key as identity, accept a client ID from the request or pass identity/provider credentials into Pi. Existing authenticated-runtime response shapes are returned for start/run and draft; trace is reduced by Studio to event count, configuration version and input/result hashes. Private bridge errors and raw trace events are not returned to the browser.

For this single-host pilot, `STUDIO_CLARA_RUNTIME_URL` accepts only an explicitly owned IPv4 loopback listener (`http://127.0.0.1:<port>/v1/clara`) with no credentials, query or fragment. This prevents a WorkOS bearer from being forwarded to a configured remote host and matches the runtime's IPv4-only bind. The Studio route uses a 35-second request bound, a 128 KiB response bound and no caching. A missing or malformed configuration leaves the route unavailable and the ordinary Studio behavior unchanged.

## Acceptance boundary

Focused local tests cover disabled configuration, origin/auth/request denial, server-owned input, actor-stable retries, sanitized reauthorized reads, private-error redaction, prepare/result/retry and reload. They do not establish the live c0001 mapping or hosted durability. Gates owns bridge deployment and one authenticated hosted pass proving one effect across retry/reload plus denial for an auth-free or differently bound subject. No database schema change is introduced by this UI/adapter slice.
