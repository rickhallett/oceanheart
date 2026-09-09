# RIC-98: tenant-scoped booking backend

A deliberately small Convex 1.45.0 / TypeScript slice, independent of the Next.js package. It does not connect or change the live website. Only synthetic data has been used.

## Reproduce the verified local run

Node 22+ (verified with Node 24), npm, and internet access for the first native Convex binary download:

```sh
npm ci
npm run typecheck
npm run test:integration
```

The integration command creates an isolated directory under `.local/`, selects free local ports, starts a real anonymous Convex backend, configures an ephemeral RS256 public JWKS, and makes HTTP requests with signed bearer JWTs. The private signing key exists only in the test process. It neither logs in nor provisions a cloud project. A subprocess regression also checks cleanup after unexpected parent exit. The process group and temporary data are removed on completion; `.local/last-report.json` and immutable `.local/reports/integration-*.json` files hold the non-secret results.

The runner waits for both backend health and its deployment configuration before setting the auth environment. It then explicitly pushes the configured functions to the existing local instance and waits for command completion. It forces `CONVEX_AGENT_MODE=anonymous` and strips inherited Convex deployment credentials. Port flags are internal CLI flags verified against the pinned 1.45.0 source; upgrading Convex requires rerunning this harness. If legacy `~/.convex/anonymous-convex-backend-state/anonymous-agent` data exists, it fails safely before starting the CLI, avoiding the pinned version's legacy-state fallback. Use a clean CI worker rather than moving or deleting unrelated local data.

`convex/_generated` is committed so a fresh checkout typechecks before starting a backend. The test deploy regenerates types in its isolated copy and checks the committed API declarations for drift. Generated artifacts are available under `.local/generated` for review; tests never rewrite source. After intentional API changes, inspect that output and update `convex/_generated/api.d.ts`.

See [WorkOS practice and task contract](docs/workos-rad.md) for the live RAD slice, hosted configuration and additive schema readiness requirements.

## Contract

- `tenants:list({})`: lists only the authenticated identity's practices as `{_id,name,role}[]`; no client identity argument.
- `tenants:create({name})`: authenticated user creates a practice and receives owner membership in the same transaction.
- `tenants:addViewer/removeViewer({tenantId, identity})`: owner-only membership changes. `identity` is the verified provider's stable issuer/subject token identifier, not a client-supplied role claim. No invitation delivery is implemented.
- `settings:get({tenantId})`: owner/viewer read of practice details (name, tagline, contact email/phone, address, practice time zone) and the default weekly availability. Tenants created before this feature read safe defaults: all seven weekdays closed, no details, revision 0.
- `settings:update({tenantId, name, tagline?, contactEmail?, contactPhone?, address?, availability, expectedRevision})`: owner-only atomic save of details plus all seven weekdays, each closed or one exact `HH:MM` open/close interval in the practice time zone. Identical retries return the current revision; divergent stale edits return `REVISION_CONFLICT`.
- `bookings:create({tenantId, practitionerId, startsAt, endsAt, clientLabel, requestKey})`: owner-only write. Timestamps are safe-integer UTC epoch milliseconds, with a positive duration of at most 24 hours. `practitionerId` is a tenant-local resource key, not yet a validated practitioner record. No clinical content belongs in the label.
- `bookings:list({tenantId, practitionerId, from, to})`: owner/viewer read of bookings **starting within** `[from,to)`, not every booking overlapping that window. Maximum window 31 days. Returns `{items, hasMore, limit:200}` in start-time order. If `hasMore`, narrow the window; cursor pagination remains future work.

A booking's interval is half-open `[startsAt, endsAt)`. Adjacent appointments are allowed. Same `requestKey` plus identical payload returns the existing ID; changed payload returns `IDEMPOTENCY_MISMATCH`. A different key with an overlapping interval returns `BOOKING_CONFLICT`. Keys are unique within a tenant, across practitioners. Membership is reread on every operation, so revocation does not wait for token expiry.

Permission errors are `UNAUTHENTICATED` or `FORBIDDEN`; input errors are `INVALID_NAME`, `INVALID_IDENTITY`, `INVALID_FIELDS`, `INVALID_INTERVAL`, `INVALID_WINDOW`. Invalid JWTs are rejected by Convex before these handlers. Caller-visible validation details can differ between local and production deployments.

## Limits and next human gate

This verifies backend transaction and permission behaviour, not a production-ready booking system. There are no practitioner availability rules, service catalogue, client identity/access, cancellations, recurrence, external calendar sync, audit log, rate limits or payment side effects. `viewer` means a staff-like tenant reader, **not** a patient/client account. The owner can create arbitrary tenant-local resource keys. Direct database/admin writes can violate the duration/index assumptions, so production migrations and new mutations must preserve the same invariants.

Managed authentication is prepared with explicit `workos`, `clerk`, `local-jwt` and `disabled` modes. See [managed auth setup](docs/managed-auth.md) for the legacy provider setup, mutual-exclusion rules and Clerk's fixed `convex` audience. This change does not configure hosted environments. Real provider login/refresh/logout, Next.js session wiring and hosted permission verification remain separate from the local JWT test evidence. The local runner needs no account login.

See [architecture decision](docs/ADR-001-backend-choice.md) and [verification record](docs/verification.md).
