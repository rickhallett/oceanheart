# Managed authentication

WorkOS is the live RAD provider: see [WorkOS setup and task contract](workos-rad.md). The Clerk setup below remains supported for existing deployments. Set `WORKOS_CLIENT_ID` to empty for every non-WorkOS mode.

The backend has exactly one explicitly selected authentication mode. Invalid or incomplete configuration rejects deployment; it does not fall back to another provider. `disabled` deliberately deploys no providers and must be selected explicitly.

Set all six variables (the five below plus `WORKOS_CLIENT_ID`) in the target Convex deployment. Convex rejects references to unset environment variables during auth-config evaluation; set unused values to an empty string.

| Variable | Clerk mode | Isolated integration runner | Disabled mode |
| --- | --- | --- | --- |
| `STUDIO_AUTH_MODE` | `clerk` | `local-jwt` | `disabled` |
| `CLERK_JWT_ISSUER_DOMAIN` | Exact Clerk Frontend API HTTPS origin, no trailing slash | empty | empty |
| `STUDIO_AUTH_ISSUER` | empty | `https://studio-test.invalid` | empty |
| `STUDIO_AUTH_JWKS` | empty | ephemeral public data-URI JWKS | empty |
| `STUDIO_AUTH_AUDIENCE` | empty | `studio-local-verification` | empty |

In Clerk, activate its Convex integration and copy the application's Frontend API URL. The backend uses Convex's OIDC provider shape `{domain, applicationID: "convex"}`. Clerk manages signing keys and discovery; the backend does not receive a Clerk secret key or a hand-written JWKS. Configure separate dev/production issuer domains when deploying those separate environments. [Official Convex Clerk setup](https://docs.convex.dev/auth/clerk).

The local JWT mode is restricted to the synthetic test issuer, audience and public data-URI key set. Never install its ephemeral trust configuration in a hosted deployment. Do not retain local JWT settings when selecting Clerk: the validator rejects mixed modes. A Clerk issuer with a path, insecure scheme or padded value is rejected instead of silently rewritten.

## Application API boundary

`tenants:list({})` reads the authenticated identity from `ctx.auth`, queries memberships by that identity, and returns `{_id, name, role}[]`. It accepts no identity or tenant selector. An authenticated account with no memberships gets an empty array; unauthenticated calls fail. Viewer memberships are included with role `viewer`, and removing membership removes discovery access using the same still-valid token. This is practice discovery, not permission to book: booking mutations retain their owner-only checks.

## Verification and limits

Local configuration tests cover managed Clerk shape, explicit disabled mode, missing/invalid inputs and mutually exclusive providers. The native-backend integration verifies the existing signed local-JWT permission and transaction slice plus membership-derived discovery. A config-shape assertion is not proof of a live Clerk session: real sign-in, token refresh and logout require separate hosted and frontend verification. This backend change implements no frontend or hosted mutation.

The test runner uses persistent `convex dev` during setup, then explicitly waits for a completed push after installing its public auth settings. It must not use the CLI's hidden `--skip-push` flag as a daemon: that skips the persistent watch and can exit once background version checks finish.
