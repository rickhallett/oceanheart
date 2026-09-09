import type { AuthConfig } from "convex/server";

type Settings = {
  mode?: string;
  workosClientId?: string;
  clerkDomain?: string;
  issuer?: string;
  jwks?: string;
  audience?: string;
};

function required(value: string | undefined, name: string): string {
  if (!value || value.trim() !== value)
    throw new Error(`Missing or padded ${name}`);
  return value;
}
function httpsOrigin(value: string, name: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    url.username ||
    url.password
  )
    throw new Error(
      `${name} must be an HTTPS origin without path or trailing slash`,
    );
  return value;
}

/** Pure configuration validation, shared by auth.config and local unit tests. */
export function buildAuthConfig(settings: Settings): AuthConfig {
  const mode = required(settings.mode, "STUDIO_AUTH_MODE");
  const customConfigured = !!(
    settings.issuer ||
    settings.jwks ||
    settings.audience
  );
  if (mode !== "workos" && settings.workosClientId)
    throw new Error("WorkOS and other provider configuration are mutually exclusive");
  if (mode === "workos") {
    if (settings.clerkDomain || customConfigured)
      throw new Error("WorkOS and other provider configuration are mutually exclusive");
    const clientId = required(settings.workosClientId, "WORKOS_CLIENT_ID");
    if (!/^client_[A-Za-z0-9]+$/.test(clientId)) throw new Error("Invalid WORKOS_CLIENT_ID");
    const jwks = `https://api.workos.com/sso/jwks/${clientId}`;
    return { providers: [
      { type: "customJwt", issuer: "https://api.workos.com/", algorithm: "RS256", jwks, applicationID: clientId },
      { type: "customJwt", issuer: `https://api.workos.com/user_management/${clientId}`, algorithm: "RS256", jwks },
    ] };
  }
  if (mode === "disabled") {
    if (settings.clerkDomain || customConfigured)
      throw new Error("Disabled auth must not retain provider configuration");
    return { providers: [] };
  }
  if (mode === "clerk") {
    if (customConfigured)
      throw new Error(
        "Clerk and custom JWT configuration are mutually exclusive",
      );
    const domain = httpsOrigin(
      required(settings.clerkDomain, "CLERK_JWT_ISSUER_DOMAIN"),
      "CLERK_JWT_ISSUER_DOMAIN",
    );
    return { providers: [{ domain, applicationID: "convex" }] };
  }
  if (mode === "local-jwt") {
    if (settings.clerkDomain)
      throw new Error(
        "Clerk and custom JWT configuration are mutually exclusive",
      );
    const issuer = httpsOrigin(
      required(settings.issuer, "STUDIO_AUTH_ISSUER"),
      "STUDIO_AUTH_ISSUER",
    );
    const jwks = required(settings.jwks, "STUDIO_AUTH_JWKS");
    const applicationID = required(settings.audience, "STUDIO_AUTH_AUDIENCE");
    // This mode is narrowly for the existing ephemeral local test harness.
    if (
      issuer !== "https://studio-test.invalid" ||
      applicationID !== "studio-local-verification" ||
      !jwks.startsWith("data:text/plain;charset=utf-8;base64,")
    )
      throw new Error(
        "local-jwt only accepts the isolated test issuer, audience and public data-URI JWKS",
      );
    return {
      providers: [
        { type: "customJwt", issuer, jwks, applicationID, algorithm: "RS256" },
      ],
    };
  }
  throw new Error("STUDIO_AUTH_MODE must be disabled, workos, clerk or local-jwt");
}
