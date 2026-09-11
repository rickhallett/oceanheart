import type { BackendIdentityBinding, BindingRequest } from "./binding-types.ts";
import { validateBinding, validateBindingRequest, workosIssuerForAudience } from "./binding-validation.ts";

export type VerifiedIdentity = {
  subject: string;
  issuer: string;
  audience: string;
};

export type SubjectBindingAuthorization = VerifiedIdentity & {
  clientId: string;
  environmentId: string;
};

function opaqueSubject(value: string) {
  return typeof value === "string" && value.length >= 3 && value.length <= 256 &&
    value.trim() === value && !/[\r\n\0]/.test(value);
}

function independentlyValidateBinding(binding: BackendIdentityBinding) {
  const request: BindingRequest = validateBindingRequest({
    schemaVersion: 1,
    clientId: binding.clientId,
    mode: "synthetic",
    manifestHash: binding.provenance.manifestHash,
    sourceSha: binding.provenance.sourceSha,
    providers: { backend: "convex", identity: "workos" },
    credentialRefs: binding.credentialRefs,
  });
  return validateBinding(binding, request);
}

export class SubjectBindingResolver {
  private readonly bindings: BackendIdentityBinding[];
  private readonly authorizations: SubjectBindingAuthorization[];

  constructor(input: {
    bindings: BackendIdentityBinding[];
    authorizations: SubjectBindingAuthorization[];
  }) {
    this.bindings = input.bindings.map(independentlyValidateBinding);
    this.authorizations = structuredClone(input.authorizations);
    const bindingKeys = new Set<string>();
    for (const binding of this.bindings) {
      const key = `${binding.clientId}\0${binding.environmentId}`;
      if (bindingKeys.has(key)) throw new Error("DUPLICATE_CONFIGURED_BINDING");
      bindingKeys.add(key);
    }
    const subjectKeys = new Set<string>();
    for (const authorization of this.authorizations) {
      if (
        !opaqueSubject(authorization.subject) ||
        !/^client_[A-Za-z0-9]{8,127}$/.test(authorization.audience) ||
        authorization.issuer !== workosIssuerForAudience(authorization.audience)
      ) throw new Error("INVALID_SUBJECT_BINDING_AUTHORIZATION");
      const key = `${authorization.issuer}\0${authorization.audience}\0${authorization.subject}`;
      if (subjectKeys.has(key)) throw new Error("AMBIGUOUS_SUBJECT_BINDING_AUTHORIZATION");
      subjectKeys.add(key);
      const binding = this.bindings.find((candidate) =>
        candidate.clientId === authorization.clientId &&
        candidate.environmentId === authorization.environmentId
      );
      if (
        !binding || binding.identity.issuer !== authorization.issuer ||
        binding.identity.audience !== authorization.audience
      ) throw new Error("SUBJECT_BINDING_CONFIGURATION_MISMATCH");
    }
  }

  resolve(identity: VerifiedIdentity) {
    if (!opaqueSubject(identity.subject)) throw new Error("UNAUTHORIZED_SUBJECT");
    const authorization = this.authorizations.find((candidate) =>
      candidate.subject === identity.subject &&
      candidate.issuer === identity.issuer &&
      candidate.audience === identity.audience
    );
    if (!authorization) throw new Error("UNAUTHORIZED_SUBJECT");
    const binding = this.bindings.find((candidate) =>
      candidate.clientId === authorization.clientId &&
      candidate.environmentId === authorization.environmentId
    );
    if (!binding) throw new Error("UNAUTHORIZED_SUBJECT");
    return structuredClone(binding);
  }
}
