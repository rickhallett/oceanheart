import assert from "node:assert/strict";
import test from "node:test";
import { loadCore } from "../scripts/load-apps-script.mjs";

test("state transitions fail closed when a required fact is absent", async () => {
  const context = await loadCore();
  const record = context.TherapyOpsCore.createClientRecord(
    "OH-ABCD1234",
    "ABCDEFGHIJKL",
    "v0.1.0",
    "2030-01-01T00:00:00.000Z",
  );

  assert.throws(
    () =>
      context.TherapyOpsCore.transition(
        context.THERAPY_OPS_CATALOG.workflow,
        record,
        "SUITABILITY_CONFIRMED",
        {
          manualSuitabilityDecision: true,
          ukAdultRemoteScopeConfirmed: false,
        },
        "practitioner",
        "2030-01-01T00:00:01.000Z",
      ),
    /GATE_BLOCKED:ukAdultRemoteScopeConfirmed/,
  );
});

test("transcription requires a current session check and affirmative choice", async () => {
  const context = await loadCore();
  const record = context.TherapyOpsCore.createClientRecord(
    "OH-ABCD1234",
    "ABCDEFGHIJKL",
    "v0.1.0",
    "2030-01-01T00:00:00.000Z",
  );

  const result = context.TherapyOpsCore.authorizeAction(
    context.THERAPY_OPS_CATALOG.workflow,
    record,
    "START_TRANSCRIPTION",
    {
      currentSessionCaptureCheck: true,
      transcriptionAllowedToday: false,
      consentVersion: "v0.1.0",
    },
    "practitioner",
    "2030-01-01T00:00:01.000Z",
  );

  assert.equal(result.allowed, false);
  assert.deepEqual(
    Array.from(result.missing),
    ["transcriptionAllowedToday"],
  );
});

test("audit events reject identifying detail fields", async () => {
  const context = await loadCore();

  assert.throws(
    () =>
      context.TherapyOpsCore.auditEvent(
        "OH-ABCD1234",
        "TEST",
        "allowed",
        "system",
        {
          clientName: "Not allowed",
        },
        "2030-01-01T00:00:00.000Z",
      ),
    /UNSAFE_AUDIT_DETAIL:clientName/,
  );
});

test("template rendering uses configuration without hiding review placeholders", async () => {
  const context = await loadCore();
  const rendered = context.TherapyOpsCore.renderTemplate(
    "Fee {{sessionFee}} and client {{clientFullName}}.",
    {
      commercial: {
        sessionFee: "[SESSION_FEE]",
      },
      clientFullName: "Synthetic Client",
    },
    true,
  );

  assert.equal(
    rendered,
    "Fee [SESSION_FEE] and client Synthetic Client.",
  );
});

test("draft configuration exposes unresolved approval placeholders", async () => {
  const context = await loadCore();
  const placeholders = context.TherapyOpsCore.findPlaceholderValues(
    context.THERAPY_OPS_CATALOG.service,
  );

  assert.ok(placeholders.length > 5);
  assert.ok(placeholders.includes("practice.insurancePolicyNumber"));
  assert.ok(placeholders.includes("dataProtection.article9Condition"));
});
