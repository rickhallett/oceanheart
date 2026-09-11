import type { Job } from "../runtime/store.ts";
import type { RunRequest } from "../runtime/contract.ts";
import type { PiWorkflowRuntime } from "../runtime/pi-adapter.ts";

export interface DurableRuntimeAdapter {
  readonly binding: {
    clientId: string;
    environmentId: string;
    backendDeploymentId: string;
  };
  startRun(request: RunRequest): Promise<Job>;
  getRun(clientId: string, runId: string): Job;
  getDraft(clientId: string, runId: string): Job["result"];
  getTrace(clientId: string, runId: string): ReturnType<PiWorkflowRuntime["exportTrace"]>;
}

export class PiDurableRuntimeAdapter implements DurableRuntimeAdapter {
  private readonly runtime: PiWorkflowRuntime;
  readonly binding: DurableRuntimeAdapter["binding"];
  constructor(runtime: PiWorkflowRuntime, binding: DurableRuntimeAdapter["binding"]) {
    this.runtime = runtime;
    this.binding = Object.freeze({ ...binding });
  }

  startRun(request: RunRequest) { return this.runtime.startRun(request); }

  getRun(clientId: string, runId: string) { return this.runtime.store.get(clientId, runId); }

  getDraft(clientId: string, runId: string) {
    this.runtime.store.get(clientId, runId);
    return this.runtime.store.result(runId);
  }

  getTrace(clientId: string, runId: string) { return this.runtime.exportTrace(clientId, runId); }
}
