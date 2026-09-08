# Hosted development handoff

Account setup completed on 8 September 2026:

- Convex team: `rick-hallett`; project: `oceanheart-studio`.
- Development deployment: `charming-albatross-632`.
- Dashboard: https://dashboard.convex.dev/t/rick-hallett/oceanheart-studio/charming-albatross-632
- Clerk application: `Oceanheart Studio`, development instance.
- Clerk issuer: `https://gentle-griffon-4091.clerk.accounts.dev`.
- Clerk's Convex integration is enabled, supplying the `convex` audience.

The development backend uses explicit `STUDIO_AUTH_MODE=clerk` with the exact issuer above. The three local JWT configuration variables are empty. Test signing keys are generated only in the isolated local test harness and are never installed in this deployment.

Clerk CLI writes development keys directly into ignored local environment files. Vercel variables are scoped to the `feat/oceanheart-studio` preview branch, with the secret key stored as a secret. Production variables remain separate. Never promote a development-auth preview to production as evidence of production identity readiness.

## Evidence and remaining acceptance

Schema and functions were pushed successfully through the authenticated Convex CLI. Direct unauthenticated HTTP calls to `tenants:list` and `tenants:create` both returned `UNAUTHENTICATED` after managed auth configuration was deployed. This demonstrates rejection of anonymous access, not successful hosted user authentication.

The isolated local suite separately verifies signed JWT validation, membership isolation/revocation, reader roles, and concurrent booking/idempotency behaviour. Complete the browser-issued Clerk session → Convex authentication → practice creation → booking → reload journey before claiming hosted signed-in acceptance.

`/app` remains a browser-local interactive mock. The independent `/practice` foundation surface is the migration path for authenticated development data. Do not import sample browser data or clinical information into hosted development.
