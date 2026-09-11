import type {
  EnvironmentBinding,
  EnvironmentBindingRegistry,
  VerifiedPrincipal,
} from "../server/binding.ts";
import { validateBinding as validateServerBinding } from "../server/binding.ts";
import { SubjectBindingResolver } from "./binding-resolver.ts";
import type { BackendIdentityBinding } from "./binding-types.ts";

export function toServerEnvironmentBinding(binding: BackendIdentityBinding): EnvironmentBinding {
  const projected: EnvironmentBinding = {
    schemaVersion: 1,
    clientId: binding.clientId,
    environmentId: binding.environmentId,
    backend: structuredClone(binding.backend),
    identity: structuredClone(binding.identity),
    provenance: {
      sourceSha: binding.provenance.sourceSha,
      source: "controller-inspection",
      observedAt: binding.provenance.observedAt,
    },
    status: "ready",
  };
  return structuredClone(validateServerBinding(projected, "hosted"));
}

export class ControllerBindingRegistryAdapter implements EnvironmentBindingRegistry {
  private readonly resolver: SubjectBindingResolver;

  constructor(resolver: SubjectBindingResolver) {
    this.resolver = resolver;
  }

  async resolveAuthorized(principal: VerifiedPrincipal) {
    if (principal.provider !== "workos") return null;
    let binding;
    try {
      binding = this.resolver.resolve({
        subject: principal.subject,
        issuer: principal.issuer,
        audience: principal.audience,
      });
    } catch {
      return null;
    }
    if (
      binding.environmentId !== principal.environmentId ||
      binding.identity.environmentId !== principal.environmentId
    ) return null;
    return toServerEnvironmentBinding(binding);
  }
}
