# ADR-001: provisionally use Convex for the first booking slice

Status: accepted for the first application slice; hosted validation awaits owner sign-in and provider access. Date: 2026-09-08. Scope: RIC-98, independent-practitioner workspace.

## Decision and evidence

Keep a small typed Convex backend for the first tenant/member/booking workflow. The useful result is a verified transaction and authentication boundary that the Next.js UI can call later. There is no frontend/backend integration in this change. PostgreSQL remains a credible alternative; no Postgres implementation or benchmark was run, and no performance, cost or migration superiority is claimed.

Convex mutations execute atomically with serializable optimistic concurrency. Our creation mutation reads both the tenant/request-key index and the candidate overlap index before writing. Those indexed read sets let the backend detect concurrent changes; application code still owns the actual invariants. A 24-hour maximum duration bounds the overlap search to possible candidates. [Convex transaction documentation](https://docs.convex.dev/database/advanced/occ).

The local test calls the native backend over HTTP with real RS256 bearer tokens, including deliberately invalid signatures/issuer/audience/expiry. It does not use `convex-test`, admin identity impersonation or mocked database transactions. The custom JWT provider accepts a public JWKS data URI for this isolated test. A hosted implementation should use an approved maintained identity provider and refresh flow. [Convex custom JWT documentation](https://docs.convex.dev/auth/advanced/custom-jwt).

## Trade-offs against a PostgreSQL implementation

| Concern | Convex slice | PostgreSQL alternative |
| --- | --- | --- |
| TypeScript UI delivery | Generated function/data types and mutation/query boundary are available directly. Reactive UI integration can be evaluated next. | API layer, schema/migration tooling and a client type generation approach must be selected. |
| Overlap and idempotency | Enforced by a single mutation and indexed reads under serializable transactions. All future writers must use equivalent invariants. | A unique `(tenant_id, request_key)` constraint and a GiST exclusion constraint on tenant, resource and `tstzrange(start,end,'[)')` could enforce these invariants at the database boundary. |
| Tenant permissions | Every public operation calls the membership helper. There is no automatic row security protecting a future careless function. | Row-level security can add a database boundary, but policies, session context and application roles need careful design; table owners/superusers can bypass normal policies. |
| Broader data workloads | Typed application queries suit this bounded slice. Reporting, migration and large-volume access need separate evaluation. | SQL, relational constraints and existing reporting/migration tooling fit more complex relational workflows. |
| Operating model | Local anonymous development proved convenient. Hosted region, backups, restore, service quotas, billing and observability are not evaluated here. | Managed Postgres or AWS operation requires the same concrete region, backup/restore, connection and cost decisions plus API hosting. |
| AWS/IAM goal | Does not demonstrate native AWS IAM integration. Selecting hosted Convex is a product-delivery choice, not fulfillment of the earlier AWS learning objective. | An AWS-hosted API/Postgres design may provide more direct IAM/CLI infrastructure work, with more operational responsibility. |

The Postgres constraint/RLS statements are architectural possibilities supported by [range and exclusion constraint documentation](https://www.postgresql.org/docs/current/rangetypes.html) and [row security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html). They have not been tested in this repository.

## Revisit criteria

Revisit when a real client requires database-enforced policy beyond functions, SQL reporting/export requirements dominate, AWS integration is a delivery constraint, hosting requirements cannot be met, or measured workload/operating costs justify it. First gather equivalent evidence with a Postgres transaction and permission test before choosing on performance grounds. Keep external payment/calendar effects outside the transaction and design an outbox/idempotent worker before adding them.

## Hosted handoff

Local anonymous deployment requires no account; it is explicitly a development facility, not a production hosting strategy. [Convex local deployment guidance](https://docs.convex.dev/cli/local-deployments). The test runner's setup follows the documented [agent-local development path](https://docs.convex.dev/cli/agent-mode). Cloud ownership, provider setup and secret wiring are the next human gate. No cloud account or service was created in this change.
