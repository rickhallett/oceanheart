# WorkOS session verification boundary

`WorkOsJwtIdentityVerifier` is the production-capable identity verifier for the existing `AuthenticatedClaraRuntime`. It does not add an HTTP route, login flow or alternate session store. A future server adapter must pass the incoming bearer header to this verifier and must construct it exclusively from controller-owned configuration.

## Fixed trust inputs

The controller supplies one exact WorkOS environment binding:

- `environmentId`: server-side registry key; never read from the request or JWT
- `audience`: exact WorkOS client ID, matched to the token's `client_id` claim
- `issuer`: exact HTTPS issuer
- `jwksUrl`: exact HTTPS public-key endpoint
- optional `WorkOsSessionStatusAdapter`: controller-owned active-session lookup for immediate revocation checks

The verifier accepts only compact bearer JWTs with an RS256 header and a bounded key ID. `jose` verifies the RSA signature, the exact client-derived issuer from the environment's OIDC discovery document and expiry. The verified payload must contain the exact configured client in `client_id`, non-empty `sub` and `sid`, and an integer `exp`; an optional conflicting `aud` is rejected. JWKS payloads are size-bounded and restricted to public RSA signing keys; symmetric/private key material and algorithm ambiguity are rejected. A missing key causes one bounded refresh for normal WorkOS rotation. Network, parsing and optional session-status failures time out and fail closed.

The runtime then resolves the verified subject against Gates' controller registry. That binding fixes the client, environment and dedicated backend. Authorization is repeated for starts and run/draft/trace reads; caller-supplied client, subject or environment values cannot select a tenant. Boundary errors are collapsed to the existing private `REQUEST_DENIED`/`SERVICE_UNAVAILABLE` responses.

## Evidence

The focused test creates ephemeral RSA keys, serves their public JWKS from a task-owned loopback HTTP server through a test-only network adapter, and signs tokens with `jose`. The real verification library and network fetch are exercised. WorkOS AuthKit user access tokens bind the application with the `client_id` claim rather than requiring a JWT `aud`; verification therefore requires exact `client_id`, and rejects a conflicting optional `aud`. It covers valid replay to one durable effect; authenticated run/draft/trace reads; cross-identity denial; auth-free and malformed denial before effects; expiry, issuer, client binding, environment, signature and algorithm confusion; key rotation; active-session revocation; and bounded JWKS/status stalls. No actual WorkOS keys, users, sessions or credentials are fixtures.

## Hosted prerequisite

This slice deliberately leaves the feature unexposed and unconfigured. Hosted enablement requires all of the following from the integration owner:

1. A provider-inspected dedicated WorkOS environment and exact client/issuer/JWKS values bound to the same client/environment record as its dedicated Convex deployment.
2. Construction of `WorkOsJwtIdentityVerifier` inside the existing authenticated Studio server boundary, never selection of a generic verifier from request input.
3. A controller-only status/introspection adapter and credential reference if immediate session revocation is required; credentials must not enter Pi, traces or repository configuration.
4. Bounded hosted acceptance with a real WorkOS session proving correct-client access and second-client/auth-free denial before claiming hosted isolation.

The existing Studio AuthKit integration is unchanged. WorkOS documents access-token validation, the JWKS endpoint and the `client_id` user-session claim in [Session tokens](https://workos.com/docs/reference/authkit/session-tokens).

At this slice's handoff, the authenticated WorkOS dashboard exposed only the existing sandbox staging and production environments, neither a dedicated `c0001` environment nor Platform credentials. The dedicated Convex target and Team Access Token resolver were also absent. The verifier must therefore remain unconfigured and unreachable; this local proof is not a hosted-authentication claim.
