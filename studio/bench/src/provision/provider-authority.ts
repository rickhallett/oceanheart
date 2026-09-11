export type ConvexBearerAuthority = {
  kind: "convex-bearer";
  token: string;
};

export type WorkosCliAuthority = {
  kind: "workos-cli-session";
  executable: string;
};

export type ProviderAuthority = ConvexBearerAuthority | WorkosCliAuthority;

export interface ProviderAuthorityResolver {
  withAuthority<T>(
    reference: string,
    provider: "convex" | "workos",
    consume: (authority: ProviderAuthority) => Promise<T>,
  ): Promise<T>;
}

export type ProviderAuthorityRegistration =
  | { provider: "convex"; kind: "environment"; variable: string }
  | { provider: "workos"; kind: "workos-cli-session"; executable: string };

const variableName = /^[A-Z][A-Z0-9_]{2,63}$/;

export class ControllerProviderAuthorityResolver implements ProviderAuthorityResolver {
  private readonly entries: ReadonlyMap<string, ProviderAuthorityRegistration>;
  private readonly environment: NodeJS.ProcessEnv;

  constructor(
    entries: ReadonlyMap<string, ProviderAuthorityRegistration>,
    environment: NodeJS.ProcessEnv = process.env,
  ) {
    this.entries = entries;
    this.environment = environment;
  }

  async withAuthority<T>(
    reference: string,
    provider: "convex" | "workos",
    consume: (authority: ProviderAuthority) => Promise<T>,
  ): Promise<T> {
    const entry = this.entries.get(reference);
    if (!entry || entry.provider !== provider) throw new Error("PROVIDER_AUTHORITY_NOT_CONFIGURED");
    if (entry.kind === "workos-cli-session") {
      if (!entry.executable.startsWith("/") || entry.executable.includes("\0"))
        throw new Error("INVALID_PROVIDER_EXECUTABLE");
      return consume({ kind: "workos-cli-session", executable: entry.executable });
    }
    if (!variableName.test(entry.variable)) throw new Error("INVALID_PROVIDER_AUTHORITY_VARIABLE");
    const token = this.environment[entry.variable];
    if (!token || token.length < 16) throw new Error("PROVIDER_AUTHORITY_NOT_CONFIGURED");
    return consume({ kind: "convex-bearer", token });
  }
}
