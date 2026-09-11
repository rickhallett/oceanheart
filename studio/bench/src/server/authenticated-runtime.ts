import { createHash } from "node:crypto";

import type { ClaraInput, ClaraResult } from "../workflows/clara.ts";
import type { ClaraAdaptationRuntimeController } from "../adaptation/runtime-controller.ts";
import { validateBinding, type EnvironmentBinding, type EnvironmentBindingRegistry, type IdentityVerifier, type VerifiedPrincipal } from "./binding.ts";
import type { DurableRuntimeAdapter } from "./runtime-adapter.ts";

export type ServerIdentityPolicy = {
  mode: "hosted" | "synthetic-test";
  environmentId: string;
  provider: EnvironmentBinding["identity"]["provider"];
  audience: string;
  issuer: string;
};

export type ClaraStartRequest = {
  authorization?: string;
  idempotencyKey: string;
  input: Omit<ClaraInput, "clientId">;
};

export type AuthenticatedRun = {
  schemaVersion: 1;
  runId: string;
  status: string;
  inspectPath: string;
  draftId?: string;
};

export class AuthenticatedRuntimeError extends Error {
  readonly code: "REQUEST_DENIED" | "SERVICE_UNAVAILABLE" | "REQUEST_CONFLICT" | "REQUEST_INVALID";
  constructor(code: "REQUEST_DENIED" | "SERVICE_UNAVAILABLE" | "REQUEST_CONFLICT" | "REQUEST_INVALID") {
    super(code === "SERVICE_UNAVAILABLE" ? "Service unavailable" : code === "REQUEST_CONFLICT" ? "Request conflicts with an existing request" : code === "REQUEST_INVALID" ? "Request invalid" : "Request denied");
    this.code = code;
    this.name = "AuthenticatedRuntimeError";
  }
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,255}$/;
const idempotencyKey = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

function actor(principal: VerifiedPrincipal) {
  return `actor:${createHash("sha256").update(`${principal.provider}:${principal.subject}`).digest("hex")}`;
}

function safeRun(job: { id: string; status: string; result?: ClaraResult }): AuthenticatedRun {
  return {
    schemaVersion: 1,
    runId: job.id,
    status: job.status,
    inspectPath: `runs/${job.id}`,
    ...(job.result?.draftId ? { draftId: job.result.draftId } : {}),
  };
}

export class AuthenticatedClaraRuntime {
  private readonly input: {
    policy: ServerIdentityPolicy;
    identity: IdentityVerifier;
    bindings: EnvironmentBindingRegistry;
    runtimeFor(binding: EnvironmentBinding): DurableRuntimeAdapter | null;
    adaptation?: ClaraAdaptationRuntimeController;
  };
  constructor(input: {
    policy: ServerIdentityPolicy;
    identity: IdentityVerifier;
    bindings: EnvironmentBindingRegistry;
    runtimeFor(binding: EnvironmentBinding): DurableRuntimeAdapter | null;
    adaptation?: ClaraAdaptationRuntimeController;
  }) {
    this.input = input;
    const policy = input.policy;
    if (!identifier.test(policy.environmentId) || !policy.audience || !policy.issuer)
      throw new Error("SERVER_IDENTITY_POLICY_INVALID");
    try {
      const issuer = new URL(policy.issuer);
      if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.search || issuer.hash)
        throw new Error("invalid issuer");
    } catch { throw new Error("SERVER_IDENTITY_POLICY_INVALID"); }
    if (input.identity.provider !== policy.provider) throw new Error("IDENTITY_PROVIDER_POLICY_MISMATCH");
    if (policy.mode === "hosted" && policy.provider !== "workos") throw new Error("TEST_IDENTITY_FORBIDDEN_IN_HOSTED_MODE");
    if (policy.mode === "synthetic-test" && policy.provider !== "synthetic-test") throw new Error("SYNTHETIC_MODE_REQUIRES_TEST_IDENTITY");
  }

  private async authorize(authorization: string | undefined) {
    let principal: VerifiedPrincipal;
    try {
      principal = await this.input.identity.verify({
        authorization,
        environmentId: this.input.policy.environmentId,
        audience: this.input.policy.audience,
        issuer: this.input.policy.issuer,
      });
    } catch { throw new AuthenticatedRuntimeError("REQUEST_DENIED"); }
    const policy = this.input.policy;
    if (
      !authorization || !principal || principal.provider !== policy.provider || !identifier.test(principal.subject) ||
      principal.environmentId !== policy.environmentId || principal.audience !== policy.audience || principal.issuer !== policy.issuer
    ) throw new AuthenticatedRuntimeError("REQUEST_DENIED");
    let binding: EnvironmentBinding | null;
    try { binding = await this.input.bindings.resolveAuthorized(principal); }
    catch { throw new AuthenticatedRuntimeError("SERVICE_UNAVAILABLE"); }
    if (!binding) throw new AuthenticatedRuntimeError("REQUEST_DENIED");
    try { validateBinding(binding, policy.mode); }
    catch { throw new AuthenticatedRuntimeError("SERVICE_UNAVAILABLE"); }
    if (
      binding.status !== "ready" || binding.environmentId !== policy.environmentId ||
      binding.identity.provider !== principal.provider || binding.identity.environmentId !== principal.environmentId ||
      binding.identity.audience !== principal.audience || binding.identity.issuer !== principal.issuer
    ) throw new AuthenticatedRuntimeError("SERVICE_UNAVAILABLE");
    let runtime: DurableRuntimeAdapter | null;
    try {
      runtime = this.input.runtimeFor(binding);
      if (
        !runtime || runtime.binding.clientId !== binding.clientId ||
        runtime.binding.environmentId !== binding.environmentId ||
        runtime.binding.backendDeploymentId !== binding.backend.deploymentId
      ) throw new Error("runtime binding mismatch");
    } catch { throw new AuthenticatedRuntimeError("SERVICE_UNAVAILABLE"); }
    return { principal, binding, runtime, actor: actor(principal) };
  }

  async startClara(request: ClaraStartRequest) {
    const authorized = await this.authorize(request.authorization);
    if (!idempotencyKey.test(request.idempotencyKey)) throw new AuthenticatedRuntimeError("REQUEST_INVALID");
    const supplied = request.input as ClaraStartRequest["input"] & { clientId?: unknown };
    const input: ClaraInput = {
      schemaVersion: supplied.schemaVersion,
      clientId: authorized.binding.clientId,
      period: supplied.period,
      sessions: supplied.sessions,
      ...(supplied.payments === undefined ? {} : { payments: supplied.payments }),
    };
    try {
      const prepared = this.input.adaptation
        ? await this.input.adaptation.prepare(input, request.idempotencyKey)
        : { input, idempotencyKey: request.idempotencyKey };
      return safeRun(await authorized.runtime.startRun({
        clientId: authorized.binding.clientId,
        actor: authorized.actor,
        idempotencyKey: prepared.idempotencyKey,
        input: prepared.input,
        ...(prepared.configurationVersion ? { configurationVersion: prepared.configurationVersion } : {}),
        ...(prepared.configurationReleaseId ? { configurationReleaseId: prepared.configurationReleaseId } : {}),
      }));
    } catch (error) {
      if (error instanceof Error && error.message === "IDEMPOTENCY_MISMATCH") throw new AuthenticatedRuntimeError("REQUEST_CONFLICT");
      throw new AuthenticatedRuntimeError("REQUEST_INVALID");
    }
  }

  private async ownedRun(authorization: string | undefined, runId: string) {
    const authorized = await this.authorize(authorization);
    if (!/^[0-9a-f-]{36}$/.test(runId)) throw new AuthenticatedRuntimeError("REQUEST_DENIED");
    try {
      const job = authorized.runtime.getRun(authorized.binding.clientId, runId);
      if (job.actor !== authorized.actor) throw new Error("WRONG_ACTOR");
      return { ...authorized, job };
    } catch { throw new AuthenticatedRuntimeError("REQUEST_DENIED"); }
  }

  async inspectRun(authorization: string | undefined, runId: string) {
    return safeRun((await this.ownedRun(authorization, runId)).job);
  }

  async inspectDraft(authorization: string | undefined, runId: string) {
    const authorized = await this.ownedRun(authorization, runId);
    try {
      const draft = authorized.runtime.getDraft(authorized.binding.clientId, runId);
      if (!draft) throw new Error("DRAFT_NOT_FOUND");
      return draft;
    } catch { throw new AuthenticatedRuntimeError("REQUEST_DENIED"); }
  }

  async inspectTrace(authorization: string | undefined, runId: string) {
    const authorized = await this.ownedRun(authorization, runId);
    try { return authorized.runtime.getTrace(authorized.binding.clientId, runId); }
    catch { throw new AuthenticatedRuntimeError("REQUEST_DENIED"); }
  }

  private async adaptation(authorization: string | undefined) {
    const authorized = await this.authorize(authorization);
    if (!this.input.adaptation) throw new AuthenticatedRuntimeError("SERVICE_UNAVAILABLE");
    return { controller: this.input.adaptation, authorized };
  }

  async adaptationStatus(authorization: string | undefined) {
    const { controller, authorized } = await this.adaptation(authorization);
    return controller.state(authorized.actor);
  }

  async evaluateAdaptation(
    authorization: string | undefined,
    request: { idempotencyKey: string; effectiveDate: string; newRateMinor: number; input: ClaraStartRequest["input"] },
  ) {
    const { controller, authorized } = await this.adaptation(authorization);
    if (!idempotencyKey.test(request.idempotencyKey)) throw new AuthenticatedRuntimeError("REQUEST_INVALID");
    const supplied = request.input as ClaraStartRequest["input"] & { clientId?: unknown };
    if (Object.hasOwn(supplied, "clientId")) throw new AuthenticatedRuntimeError("REQUEST_INVALID");
    const input: ClaraInput = { ...supplied, clientId: authorized.binding.clientId };
    try {
      return await controller.evaluate(authorized.actor, request.idempotencyKey, input, request.effectiveDate, request.newRateMinor);
    } catch { throw new AuthenticatedRuntimeError("REQUEST_INVALID"); }
  }

  async activateAdaptation(
    authorization: string | undefined,
    proposalId: string,
    expectedActiveReleaseId: string,
  ) {
    const { controller, authorized } = await this.adaptation(authorization);
    try { return await controller.activate(authorized.actor, proposalId, expectedActiveReleaseId); }
    catch { throw new AuthenticatedRuntimeError("REQUEST_CONFLICT"); }
  }

  async rollbackAdaptation(
    authorization: string | undefined,
    targetReleaseId: string,
    expectedActiveReleaseId: string,
  ) {
    const { controller, authorized } = await this.adaptation(authorization);
    try { return await controller.rollback(authorized.actor, targetReleaseId, expectedActiveReleaseId); }
    catch { throw new AuthenticatedRuntimeError("REQUEST_CONFLICT"); }
  }
}
