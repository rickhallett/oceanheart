import type { ProvisionManifest } from "../../src/provision/types.ts";

export const sourceSha = "a".repeat(40);
export const configSha = "b".repeat(40);

export function validManifest(clientId = "c0001"): ProvisionManifest {
  return {
    schemaVersion: 1,
    clientId,
    mode: "synthetic",
    template: { version: "1.0.0", sourceSha },
    code: { repository: `oceanheart/studio-${clientId}`, releaseSha: null },
    runtime: {
      provider: "exe.dev",
      region: "london",
      runtimeName: `studio-${clientId}-runtime`,
      developmentName: `studio-${clientId}-builder`,
      vmId: null,
      artifactDigest: null,
    },
    harness: { kind: "pi", version: "0.85.1", profile: "workflow" },
    configuration: {
      instructionsVersion: configSha,
      toolsetVersion: configSha,
      modelProfile: "synthetic-default",
    },
    data: {
      backendRef: `synthetic://${clientId}/backend`,
      retrievalRef: null,
    },
    credentials: {
      model: `secretref://${clientId}/runtime/model`,
      mail: null,
    },
    limits: { maxConcurrentRuns: 1, maxRunSeconds: 180, maxToolCalls: 30 },
    evaluationSet: "mock-clients/CL-01",
  };
}
