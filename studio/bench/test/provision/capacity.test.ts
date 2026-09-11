import assert from "node:assert/strict";
import test from "node:test";
import { assessExeCapacity } from "../../src/provision/capacity.ts";

test("blocks a two-VM pilot when current disk already exceeds allowance", () => {
  const result = assessExeCapacity({
    provider: "exe.dev",
    capturedAt: "2026-09-11T12:00:00Z",
    plan: { maxVms: 50, maxCpus: 2, maxMemoryGb: 8, includedDiskBytes: 107374182400 },
    usage: { vmCount: 14, diskUsedBytes: 130394591232 },
  });
  assert.equal(result.projectedVmCount, 16);
  assert.equal(result.currentDiskOverageBytes, 23020408832);
  assert.equal(result.fitsObservedLimits, false);
});

test("allows a within-plan synthetic capacity shape", () => {
  const result = assessExeCapacity({
    provider: "exe.dev",
    capturedAt: "2026-09-11T12:00:00Z",
    plan: { maxVms: 5, maxCpus: 2, maxMemoryGb: 8, includedDiskBytes: 1000 },
    usage: { vmCount: 1, diskUsedBytes: 500 },
  });
  assert.equal(result.fitsObservedLimits, true);
  assert.deepEqual(result.blockers, []);
});
