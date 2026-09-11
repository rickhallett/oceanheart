import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { ClaraFixture, FixturePartition } from "./contracts.ts";

const fixtureDirectory = fileURLToPath(
  new URL("../../fixtures/clara/", import.meta.url),
);

export async function loadClaraFixtures(
  partition?: FixturePartition,
): Promise<ClaraFixture[]> {
  const filenames = (await readdir(fixtureDirectory))
    .filter((filename) => /^cl-0[1-8]\.json$/.test(filename))
    .sort();
  const fixtures = await Promise.all(
    filenames.map(async (filename) => {
      const raw = await readFile(`${fixtureDirectory}/${filename}`, "utf8");
      return JSON.parse(raw) as ClaraFixture;
    }),
  );
  return partition ? fixtures.filter((fixture) => fixture.partition === partition) : fixtures;
}

export function validateClaraFixture(fixture: ClaraFixture): string[] {
  const errors: string[] = [];
  if (fixture.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!/^CL-0[1-8]$/.test(fixture.caseId)) errors.push("caseId must be CL-01 through CL-08");
  if (!fixture.fixedClock.endsWith("Z")) errors.push("fixedClock must be UTC ISO time");
  if (fixture.input.schemaVersion !== 1) errors.push("input must use canonical ClaraInput schemaVersion 1");
  if (fixture.input.clientId !== fixture.request.clientId) errors.push("request and input client IDs must match");
  if (fixture.expected.totalMinor < 0) errors.push("invoice total cannot be negative");
  if (fixture.expected.sourceIds.length === 0) errors.push("source IDs are required");
  if (fixture.expected.requiredEffectKinds.length === 0) {
    errors.push("at least one required effect is required");
  }
  if (
    fixture.expected.requiredEffectKinds.some((effect) =>
      fixture.expected.prohibitedEffectKinds.includes(effect),
    )
  ) {
    errors.push("an effect cannot be both required and prohibited");
  }
  return errors;
}
