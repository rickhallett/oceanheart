import type { ProvisionManifest, ResourceKind } from "./types.ts";

export type ResourceRequest = {
  clientId: string;
  manifestHash: string;
  manifest: ProvisionManifest;
  resource: ResourceKind;
  idempotencyKey: string;
};

export type ReconcileResult =
  | {
      state: "owned";
      externalId: string;
      sshDest?: string;
    }
  | {
      state: "absent";
      retrySafe: boolean;
      detail?: string;
    }
  | {
      state: "foreign";
      detail: string;
    }
  | {
      state: "unknown";
      detail: string;
    };

export type CreatedResource = {
  externalId: string;
  sshDest?: string;
};

export interface ProvisionProvider {
  readonly name: string;
  reconcileResource(request: ResourceRequest): Promise<ReconcileResult>;
  createResource(request: ResourceRequest): Promise<CreatedResource>;
}

export class ProviderEffectUncertainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderEffectUncertainError";
  }
}

export class ProviderCreateRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderCreateRejectedError";
  }
}

export class ProvisionEffectUncertainError extends Error {
  readonly resource: ResourceKind;

  constructor(resource: ResourceKind, message: string) {
    super(message);
    this.name = "ProvisionEffectUncertainError";
    this.resource = resource;
  }
}

export class ProvisionCollisionError extends Error {
  readonly resource: ResourceKind;

  constructor(resource: ResourceKind, message: string) {
    super(message);
    this.name = "ProvisionCollisionError";
    this.resource = resource;
  }
}
