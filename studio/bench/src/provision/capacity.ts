export type ExeCapacitySnapshot = {
  provider: "exe.dev";
  capturedAt: string;
  plan: {
    maxVms: number;
    maxCpus: number;
    maxMemoryGb: number;
    includedDiskBytes: number;
  };
  usage: {
    vmCount: number;
    diskUsedBytes: number;
  };
};

export type CapacityAssessment = {
  provider: "exe.dev";
  requiredNewVms: 2;
  projectedVmCount: number;
  currentDiskOverageBytes: number;
  fitsObservedLimits: boolean;
  blockers: string[];
};

function nonNegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(`${label} must be a non-negative safe integer`);
  return value as number;
}

export function assessExeCapacity(value: unknown): CapacityAssessment {
  if (!value || typeof value !== "object") throw new Error("Capacity snapshot must be an object");
  const snapshot = value as ExeCapacitySnapshot;
  if (snapshot.provider !== "exe.dev") throw new Error("Capacity provider must be exe.dev");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(snapshot.capturedAt))
    throw new Error("Capacity snapshot requires an ISO timestamp");
  const maxVms = nonNegativeInteger(snapshot.plan?.maxVms, "plan.maxVms");
  nonNegativeInteger(snapshot.plan?.maxCpus, "plan.maxCpus");
  nonNegativeInteger(snapshot.plan?.maxMemoryGb, "plan.maxMemoryGb");
  const includedDiskBytes = nonNegativeInteger(
    snapshot.plan?.includedDiskBytes,
    "plan.includedDiskBytes",
  );
  const vmCount = nonNegativeInteger(snapshot.usage?.vmCount, "usage.vmCount");
  const diskUsedBytes = nonNegativeInteger(
    snapshot.usage?.diskUsedBytes,
    "usage.diskUsedBytes",
  );
  const projectedVmCount = vmCount + 2;
  const currentDiskOverageBytes = Math.max(0, diskUsedBytes - includedDiskBytes);
  const blockers: string[] = [];
  if (projectedVmCount > maxVms)
    blockers.push("Two additional VMs would exceed the account VM-count limit");
  if (currentDiskOverageBytes > 0)
    blockers.push("Current disk usage already exceeds the included allowance");
  if (snapshot.plan.maxCpus < 2 || snapshot.plan.maxMemoryGb < 4)
    blockers.push("Pooled compute is below the minimum synthetic pilot gate");
  return {
    provider: "exe.dev",
    requiredNewVms: 2,
    projectedVmCount,
    currentDiskOverageBytes,
    fitsObservedLimits: blockers.length === 0,
    blockers,
  };
}
