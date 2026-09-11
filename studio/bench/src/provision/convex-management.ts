import {
  BindingConflictError,
  BindingCreateRejectedError,
  BindingEffectUncertainError,
} from "./binding-provider.ts";
import type { ProviderAuthorityResolver } from "./provider-authority.ts";
import type { ApprovedProviderTarget } from "./provider-target.ts";

type Fetch = typeof fetch;

type ConvexProject = {
  id: number;
  name: string;
  slug: string;
  teamId: number;
  teamSlug: string;
};

type ConvexDeployment = {
  id: number;
  name: string;
  deploymentType: string;
  projectId: number;
  reference: string | null;
  deploymentUrl: string;
  kind: string;
};

export type ConvexInspection =
  | { state: "absent" }
  | { state: "project-only"; project: ConvexProject }
  | { state: "owned"; project: ConvexProject; deployment: ConvexDeployment }
  | { state: "foreign" }
  | { state: "unknown" };

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function project(value: unknown): ConvexProject | undefined {
  const item = record(value);
  if (
    !item || !Number.isSafeInteger(item.id) || typeof item.name !== "string" ||
    typeof item.slug !== "string" || !Number.isSafeInteger(item.teamId) ||
    typeof item.teamSlug !== "string"
  ) return undefined;
  return item as ConvexProject;
}

function deployment(value: unknown): ConvexDeployment | undefined {
  const item = record(value);
  if (
    !item || !Number.isSafeInteger(item.id) || typeof item.name !== "string" ||
    typeof item.deploymentType !== "string" || !Number.isSafeInteger(item.projectId) ||
    (item.reference !== null && typeof item.reference !== "string") ||
    typeof item.deploymentUrl !== "string" || typeof item.kind !== "string"
  ) return undefined;
  return item as ConvexDeployment;
}

export class ConvexManagementTransport {
  private readonly target: ApprovedProviderTarget;
  private readonly resolver: ProviderAuthorityResolver;
  private readonly fetcher: Fetch;
  private readonly baseUrl: string;

  constructor(
    target: ApprovedProviderTarget,
    resolver: ProviderAuthorityResolver,
    options: { fetcher?: Fetch; baseUrl?: string } = {},
  ) {
    this.target = target;
    this.resolver = resolver;
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.convex.dev/v1";
  }

  private async request(method: "GET" | "POST", path: string, body?: object) {
    return this.resolver.withAuthority(this.target.credentialRefs.backend, "convex", async (authority) => {
      if (authority.kind !== "convex-bearer") throw new Error("INVALID_CONVEX_AUTHORITY");
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${authority.token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        throw new BindingEffectUncertainError("Convex transport failed");
      }
      if (!response.ok) {
        if ([400, 401, 403, 404, 422].includes(response.status))
          throw new BindingCreateRejectedError(`Convex request rejected (${response.status})`);
        throw new BindingEffectUncertainError(`Convex request outcome uncertain (${response.status})`);
      }
      try { return await response.json() as unknown; }
      catch { throw new BindingEffectUncertainError("Convex response was invalid"); }
    });
  }

  async inspect(): Promise<ConvexInspection> {
    let response: unknown;
    try {
      const query = new URLSearchParams({ limit: "100", q: this.target.convex.projectName });
      response = await this.request("GET", `/teams/${this.target.convex.teamId}/projects?${query}`);
    } catch (error) {
      if (error instanceof BindingCreateRejectedError) return { state: "foreign" };
      return { state: "unknown" };
    }
    const items = record(response)?.items;
    const pagination = record(record(response)?.pagination);
    if (!Array.isArray(items)) return { state: "unknown" };
    if (typeof pagination?.nextCursor === "string" && pagination.nextCursor.length > 0)
      return { state: "unknown" };
    const matches = items.map(project).filter((item): item is ConvexProject =>
      item !== undefined && item.name === this.target.convex.projectName,
    );
    if (matches.length === 0) return { state: "absent" };
    if (matches.length !== 1 || matches[0].teamId !== this.target.convex.teamId)
      return { state: "foreign" };
    const matched = matches[0];
    let deploymentsResponse: unknown;
    try {
      deploymentsResponse = await this.request(
        "GET",
        `/projects/${matched.id}/list_deployments?includeLocal=false`,
      );
    } catch (error) {
      if (error instanceof BindingCreateRejectedError) return { state: "foreign" };
      return { state: "unknown" };
    }
    if (!Array.isArray(deploymentsResponse)) return { state: "unknown" };
    const matchesDeployment = deploymentsResponse.map(deployment).filter((item): item is ConvexDeployment =>
      item !== undefined && item.reference === this.target.convex.deploymentReference,
    );
    if (matchesDeployment.length === 0) return { state: "project-only", project: matched };
    if (matchesDeployment.length !== 1) return { state: "foreign" };
    const matchedDeployment = matchesDeployment[0];
    let deploymentUrl: URL;
    try { deploymentUrl = new URL(matchedDeployment.deploymentUrl); }
    catch { return { state: "foreign" }; }
    if (
      matchedDeployment.kind !== "cloud" || matchedDeployment.projectId !== matched.id ||
      matchedDeployment.deploymentType !== this.target.convex.deploymentType ||
      deploymentUrl.protocol !== "https:" || !deploymentUrl.hostname.endsWith(".convex.cloud")
    ) return { state: "foreign" };
    return { state: "owned", project: matched, deployment: matchedDeployment };
  }

  async createMissing(): Promise<void> {
    let observation = await this.inspect();
    let externalEffectPresent = observation.state === "project-only" || observation.state === "owned";
    if (observation.state === "foreign") throw new BindingConflictError("Convex target conflicts");
    if (observation.state === "unknown") throw new BindingEffectUncertainError("Convex target inspection failed");
    if (observation.state === "absent") {
      await this.request("POST", `/teams/${this.target.convex.teamId}/create_project`, {
        projectName: this.target.convex.projectName,
        deploymentType: null,
      });
      externalEffectPresent = true;
      observation = await this.inspect();
      if (observation.state !== "project-only" && observation.state !== "owned")
        throw new BindingEffectUncertainError("Convex project was not confirmed");
    }
    if (observation.state === "project-only") {
      try {
        await this.request("POST", `/projects/${observation.project.id}/create_deployment`, {
          type: this.target.convex.deploymentType,
          reference: this.target.convex.deploymentReference,
          isDefault: false,
        });
      } catch (error) {
        if (externalEffectPresent && error instanceof BindingCreateRejectedError)
          throw new BindingEffectUncertainError("Convex partial target requires reconciliation");
        throw error;
      }
      observation = await this.inspect();
    }
    if (observation.state !== "owned")
      throw new BindingEffectUncertainError("Convex deployment was not confirmed");
  }
}
