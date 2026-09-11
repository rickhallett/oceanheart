import { createHash } from "node:crypto";

import type { ClaraFixture } from "../eval/contracts.ts";
import {
  adaptedConfiguration,
  baselineConfiguration,
  configuredClaraInput,
} from "../eval/configuration.ts";
import type { ClaraRateChangePolicy } from "../workflows/adaptation.ts";

export type ClaraConfigurationArtifact = {
  schemaVersion: 1;
  workflow: "clara-draft-invoice";
  clientId: string;
  version: string;
  instructionsVersion: string;
  toolsetVersion: string;
  modelProfile: string;
  dataCompatibility: "no-change";
  policy: ClaraRateChangePolicy | null;
};

export function artifactDigest(artifact: ClaraConfigurationArtifact): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(artifact)).digest("hex")}`;
}

export function baselineArtifact(
  configuration: {
    id: string;
    instructionsVersion: string;
    toolsetVersion: string;
    modelProfile: string;
  },
  clientId: string,
): ClaraConfigurationArtifact {
  if (configuration.id !== baselineConfiguration) throw new Error("INVALID_BASELINE_CONFIGURATION");
  return {
    schemaVersion: 1,
    workflow: "clara-draft-invoice",
    clientId,
    version: configuration.id,
    instructionsVersion: configuration.instructionsVersion,
    toolsetVersion: configuration.toolsetVersion,
    modelProfile: configuration.modelProfile,
    dataCompatibility: "no-change",
    policy: null,
  };
}

export function requestedArtifact(
  configuration: {
    id: string;
    instructionsVersion: string;
    toolsetVersion: string;
    modelProfile: string;
  },
  fixture: ClaraFixture,
  request: { effectiveDate: string; newRateMinor: number },
): ClaraConfigurationArtifact {
  const policy = fixture.rateChangePolicy;
  if (
    fixture.caseId !== "CL-09" ||
    configuration.id !== adaptedConfiguration ||
    !policy ||
    policy.clientId !== fixture.clientId ||
    policy.effectiveDate !== request.effectiveDate ||
    policy.newStandardRate.minor !== request.newRateMinor
  ) {
    throw new Error("RATE_CHANGE_REQUEST_DOES_NOT_MATCH_REVIEWED_SCOPE");
  }
  return {
    schemaVersion: 1,
    workflow: "clara-draft-invoice",
    clientId: fixture.clientId,
    version: configuration.id,
    instructionsVersion: configuration.instructionsVersion,
    toolsetVersion: configuration.toolsetVersion,
    modelProfile: configuration.modelProfile,
    dataCompatibility: "no-change",
    policy: structuredClone(policy),
  };
}

export function configuredInputForArtifact(
  fixture: ClaraFixture,
  artifact: ClaraConfigurationArtifact,
) {
  if (artifact.clientId !== fixture.clientId) return structuredClone(fixture.input);
  if (artifact.version === baselineConfiguration && artifact.policy === null) {
    return configuredClaraInput(fixture, baselineConfiguration);
  }
  if (
    artifact.version !== adaptedConfiguration ||
    !artifact.policy ||
    JSON.stringify(artifact.policy) !== JSON.stringify(fixture.rateChangePolicy)
  ) {
    throw new Error("CONFIGURATION_FIXTURE_SCOPE_MISMATCH");
  }
  return configuredClaraInput(fixture, adaptedConfiguration);
}
