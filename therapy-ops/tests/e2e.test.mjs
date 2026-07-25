import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runSyntheticScenario } from "../scripts/synthetic-harness.mjs";

test("synthetic journey proves every external side effect is gated", async () => {
  const { proof } = await runSyntheticScenario();

  assert.equal(proof.dataClassification, "SYNTHETIC_ONLY");
  assert.equal(proof.externalCallsPerformed, false);
  assert.equal(proof.finalState, "CLOSED");
  assert.equal(proof.setup.acceptingResponses, false);
  assert.equal(proof.artifacts.calendarEvents, 1);
  assert.equal(proof.artifacts.sessionChecks, 1);
  assert.equal(proof.artifacts.aiRequests, 1);
  assert.ok(
    Object.values(proof.verifiedInvariants).every(Boolean),
    JSON.stringify(proof.verifiedInvariants, null, 2),
  );
  assert.match(
    proof.blockedOperations.realIntakeActivation,
    /REAL_CLIENT_USE_NOT_APPROVED/,
  );
});

test("committed proof matches the deterministic synthetic scenario", async () => {
  const { proof } = await runSyntheticScenario();
  const committed = JSON.parse(
    await readFile(
      new URL("../evidence/synthetic-e2e-proof.json", import.meta.url),
      "utf8",
    ),
  );

  assert.deepEqual(committed, proof);
});
