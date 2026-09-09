import { buildAuthConfig } from "../auth-policy";

// Set all six variables explicitly (unused values to empty strings). Convex
// rejects reads of undefined deployment env vars during auth config evaluation.
// Never silently fall back from a selected provider to unauthenticated mode.
export default buildAuthConfig({
  workosClientId: process.env.WORKOS_CLIENT_ID,
  mode: process.env.STUDIO_AUTH_MODE,
  clerkDomain: process.env.CLERK_JWT_ISSUER_DOMAIN,
  issuer: process.env.STUDIO_AUTH_ISSUER,
  jwks: process.env.STUDIO_AUTH_JWKS,
  audience: process.env.STUDIO_AUTH_AUDIENCE,
});
