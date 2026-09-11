import type { BindingRequest, ProviderEnvironmentBinding } from "./binding-types.ts";

export type BindingProviderRequest = BindingRequest & {
  operationId: string;
  idempotencyKey: string;
};

export type BindingReconcileResult =
  | { state: "owned"; binding: ProviderEnvironmentBinding }
  | { state: "absent"; retrySafe: boolean }
  | { state: "foreign" }
  | { state: "partial"; retrySafe: boolean }
  | { state: "unknown" };

export interface BackendIdentityProvider {
  readonly name: string;
  reconcileEnvironment(request: BindingProviderRequest): Promise<BindingReconcileResult>;
  createEnvironment(request: BindingProviderRequest): Promise<ProviderEnvironmentBinding>;
}

export class BindingCreateRejectedError extends Error {
  constructor(message = "Provider rejected binding creation before an external effect") {
    super(message);
    this.name = "BindingCreateRejectedError";
  }
}

export class BindingEffectUncertainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingEffectUncertainError";
  }
}

export class BindingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingConflictError";
  }
}
