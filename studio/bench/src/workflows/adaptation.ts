import { validateInput, type ClaraInput } from './clara.ts';

/** Explicit operator policy. A reference identifies a standard schedule, never inferred from price. */
export interface ClaraRateChangePolicy {
  schemaVersion: 1;
  version: string;
  clientId: string;
  effectiveDate: string;
  previousStandardRate: { minor: number; reference: string };
  newStandardRate: { minor: number; reference: string };
  eligible: Array<{ sessionId: string; clientId: string }>;
}

function label(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200;
}
function rate(value: ClaraRateChangePolicy['newStandardRate']): boolean {
  return !!value && Number.isSafeInteger(value.minor) && value.minor >= 0 && label(value.reference);
}
function calendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/**
 * Return a detached input; never mutate a ledger, draft, payment or another practice.
 * Only exact previous standard-rate matches change. Negotiated/unknown references,
 * mismatching amounts, issued sessions, prepaid allocations and cancellations stay intact.
 * The caller retains policy.version with its run/config receipt; ClaraInput stays compatible.
 */
export function applyClaraRateChange(input: ClaraInput, policy: ClaraRateChangePolicy): ClaraInput {
  validateInput(input);
  if (!policy || policy.schemaVersion !== 1 || !label(policy.version) ||
      policy.clientId !== input.clientId || !calendarDate(policy.effectiveDate) ||
      !rate(policy.previousStandardRate) || !rate(policy.newStandardRate) ||
      policy.previousStandardRate.reference === policy.newStandardRate.reference ||
      !Array.isArray(policy.eligible) || !policy.eligible.length || policy.eligible.length > 1000) {
    throw new Error('INVALID_RATE_CHANGE_POLICY');
  }
  const sessions = new Map(input.sessions.map(session => [session.id, session]));
  const eligible = new Set<string>();
  for (const target of policy.eligible) {
    if (!target || !label(target.sessionId) || !label(target.clientId) || eligible.has(target.sessionId)) {
      throw new Error('INVALID_RATE_CHANGE_SCOPE');
    }
    const session = sessions.get(target.sessionId);
    if (!session || session.clientId !== target.clientId) throw new Error('INVALID_RATE_CHANGE_SCOPE');
    eligible.add(target.sessionId);
  }
  const result = structuredClone(input);
  for (const session of result.sessions) {
    if (!eligible.has(session.id) || session.date < policy.effectiveDate ||
        session.priorInvoiceId || session.prepaid || session.attendance === 'cancelled' ||
        session.rateRef !== policy.previousStandardRate.reference ||
        session.rateMinor !== policy.previousStandardRate.minor) continue;
    session.rateMinor = policy.newStandardRate.minor;
    session.rateRef = policy.newStandardRate.reference;
  }
  return result;
}
