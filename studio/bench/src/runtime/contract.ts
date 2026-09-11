/** Canonical fixture/result schema shared with eval; no provider or credentials required. */
export { calculateInvoice, validateInput } from '../workflows/clara.ts';
export type { ClaraInput, ClaraResult } from '../workflows/clara.ts';
export interface RunRequest {
  clientId: string; actor: string; idempotencyKey: string;
  configurationVersion?: string;
  configurationReleaseId?: string;
  input: import('../workflows/clara.ts').ClaraInput;
}
export interface RunLimits { maxRunMs: number; maxToolCalls: number; maxTurns: number }
export type RunStatus = 'queued'|'running'|'waiting_for_input'|'succeeded'|'failed'|'cancelled'|'effect_uncertain';
