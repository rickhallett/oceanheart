import assert from "node:assert/strict";
import test from "node:test";
import {
  ManifestValidationError,
  hashManifest,
  validateManifest,
} from "../../src/provision/manifest.ts";
import { validManifest } from "./fixture.ts";

test("validates a closed, synthetic, client-scoped manifest deterministically", () => {
  const manifest = validManifest();
  assert.deepEqual(validateManifest(structuredClone(manifest)), manifest);
  assert.equal(hashManifest(manifest), hashManifest(structuredClone(manifest)));
});

test("rejects placeholders, unknown fields, raw secrets and cross-client references", () => {
  const cases: unknown[] = [];
  const placeholder = structuredClone(validManifest());
  placeholder.template.version = "TBD";
  cases.push(placeholder);
  const extra = structuredClone(validManifest()) as ProvisionManifest & { surprise: boolean };
  extra.surprise = true;
  cases.push(extra);
  const secret = structuredClone(validManifest());
  secret.credentials.model = "sk_test_secretcanary123";
  cases.push(secret);
  const foreign = structuredClone(validManifest());
  foreign.data.backendRef = "synthetic://c9999/backend";
  cases.push(foreign);
  for (const candidate of cases)
    assert.throws(() => validateManifest(candidate), ManifestValidationError);
});

type ProvisionManifest = ReturnType<typeof validManifest>;
