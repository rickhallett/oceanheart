import {
  BindingConflictError,
  BindingEffectUncertainError,
  type BackendIdentityProvider,
  type BindingProviderRequest,
  type BindingReconcileResult,
} from "./binding-provider.ts";
import { ConvexManagementTransport } from "./convex-management.ts";
import type { ProviderEnvironmentBinding } from "./binding-types.ts";
import { validateApprovedProviderTarget, type ApprovedProviderTarget } from "./provider-target.ts";
import { WorkosAccountTransport } from "./workos-account.ts";

export class ConvexWorkosBindingProvider implements BackendIdentityProvider {
  readonly name = "convex-management-workos-account";
  private readonly target: ApprovedProviderTarget;
  private readonly convex: ConvexManagementTransport;
  private readonly workos: WorkosAccountTransport;

  constructor(
    target: ApprovedProviderTarget,
    convex: ConvexManagementTransport,
    workos: WorkosAccountTransport,
  ) {
    this.target = validateApprovedProviderTarget(target);
    this.convex = convex;
    this.workos = workos;
  }

  private assertRequest(request: BindingProviderRequest) {
    if (
      request.clientId !== this.target.clientId || request.sourceSha !== this.target.sourceSha ||
      request.manifestHash !== this.target.manifestHash ||
      request.credentialRefs.backend !== this.target.credentialRefs.backend ||
      request.credentialRefs.identity !== this.target.credentialRefs.identity
    ) throw new BindingConflictError("Provider request does not match approved target");
  }

  async reconcileEnvironment(request: BindingProviderRequest): Promise<BindingReconcileResult> {
    this.assertRequest(request);
    const [convex, workos] = await Promise.all([this.convex.inspect(), this.workos.inspect()]);
    if (convex.state === "foreign" || workos.state === "foreign") return { state: "foreign" };
    if (convex.state === "unknown" || workos.state === "unknown") return { state: "unknown" };
    if (convex.state === "owned" && workos.state === "owned") {
      const binding: ProviderEnvironmentBinding = {
        environmentId: workos.environment.id,
        classification: "synthetic",
        isolation: "dedicated",
        attestedClientId: this.target.clientId,
        backend: {
          provider: "convex",
          deploymentId: String(convex.deployment.id),
          url: convex.deployment.deploymentUrl,
        },
        identity: {
          provider: "workos",
          environmentId: workos.environment.id,
          issuer: "https://api.workos.com/",
          audience: workos.environment.clientId,
        },
      };
      return { state: "owned", binding };
    }
    if (convex.state === "absent" && workos.state === "absent")
      return { state: "absent", retrySafe: true };
    return { state: "partial", retrySafe: true };
  }

  async createEnvironment(request: BindingProviderRequest): Promise<ProviderEnvironmentBinding> {
    this.assertRequest(request);
    await this.convex.createMissing();
    await this.workos.createMissing();
    const result = await this.reconcileEnvironment(request);
    if (result.state !== "owned")
      throw new BindingEffectUncertainError("Provider binding was not confirmed after create");
    return result.binding;
  }
}
