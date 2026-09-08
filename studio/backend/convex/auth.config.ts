import type { AuthConfig } from "convex/server";
// No configured provider means no token is trusted. Local tests set an ephemeral
// public JWKS; production must use a separately approved identity provider.
const issuer = process.env.STUDIO_AUTH_ISSUER;
const jwks = process.env.STUDIO_AUTH_JWKS;
const applicationID = process.env.STUDIO_AUTH_AUDIENCE;
export default {
  providers:
    issuer && jwks && applicationID
      ? [{ type: "customJwt", issuer, jwks, applicationID, algorithm: "RS256" }]
      : [],
} satisfies AuthConfig;
