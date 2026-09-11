import { applyClaraRateChange } from "../workflows/adaptation.ts";
import type { ClaraFixture } from "./contracts.ts";

export const baselineConfiguration = "clara-2026-09-01";
export const adaptedConfiguration = "clara-2026-10-01-rate-change";

/** Only reviewed fixture policies are applied; the model never chooses its rate scope. */
export function configuredClaraInput(fixture: ClaraFixture, version: string) {
  if (![baselineConfiguration, adaptedConfiguration].includes(version)) throw new Error("UNKNOWN_CONFIGURATION");
  if (version === adaptedConfiguration && fixture.rateChangePolicy) {
    return applyClaraRateChange(fixture.input, fixture.rateChangePolicy);
  }
  return structuredClone(fixture.input);
}
