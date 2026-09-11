import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyClaraRateChange, type ClaraRateChangePolicy } from '../../src/workflows/adaptation.ts';
import { calculateInvoice, type ClaraInput } from '../../src/workflows/clara.ts';

const session = (id: string, date = '2026-10-01'): ClaraInput['sessions'][number] => ({
  id, clientId: 'person-a', date, attendance: 'attended', rateMinor: 8000, rateRef: 'standard-v1',
});
const input: ClaraInput = {
  schemaVersion: 1, clientId: 'CL', period: { from: '2026-09-01', to: '2026-10-31' },
  sessions: [session('before', '2026-09-30'), session('effective'), session('after', '2026-10-02')],
};
const policy: ClaraRateChangePolicy = {
  schemaVersion: 1, version: 'clara-october-v2', clientId: 'CL', effectiveDate: '2026-10-01',
  previousStandardRate: { minor: 8000, reference: 'standard-v1' },
  newStandardRate: { minor: 9000, reference: 'standard-v2' },
  eligible: input.sessions.map(s => ({ sessionId: s.id, clientId: s.clientId })),
};

test('effective date is inclusive; historical rates remain and transformation is detached/idempotent', () => {
  const original = structuredClone(input), originalPolicy = structuredClone(policy);
  const adapted = applyClaraRateChange(input, policy);
  assert.deepEqual(adapted.sessions.map(s => s.rateMinor), [8000, 9000, 9000]);
  assert.deepEqual(adapted.sessions.map(s => s.rateRef), ['standard-v1', 'standard-v2', 'standard-v2']);
  assert.equal(calculateInvoice(adapted).totalMinor, 26000);
  assert.deepEqual(applyClaraRateChange(adapted, policy), adapted);
  assert.deepEqual(input, original); assert.deepEqual(policy, originalPolicy);
  adapted.period.from = '2026-10-01'; assert.equal(input.period.from, '2026-09-01');
});

test('scope cannot implicitly override agreements, issued/prepaid/cancelled sessions or other people', () => {
  const cases: ClaraInput = { ...input, sessions: [
    { ...session('negotiated'), rateRef: 'negotiated-v1' },
    { ...session('exception'), rateMinor: 7000 },
    { ...session('issued'), priorInvoiceId: 'invoice-1' },
    { ...session('prepaid'), prepaid: true },
    { ...session('cancelled'), attendance: 'cancelled', cancellationChargeMinor: 4000, policyRef: 'cancel-v1' },
    { ...session('unknown-rate'), rateRef: undefined },
    { ...session('other-person'), clientId: 'person-b' },
    session('eligible'),
  ], payments: [{ invoiceId: 'invoice-1', invoiceTotalMinor: 8000, receivedMinor: 5000 }] };
  const scoped = { ...policy, eligible: cases.sessions.filter(s => s.id !== 'other-person').map(s => ({ sessionId: s.id, clientId: s.clientId })) };
  const changed = applyClaraRateChange(cases, scoped);
  assert.deepEqual(changed.sessions.slice(0, -1), cases.sessions.slice(0, -1));
  assert.equal(changed.sessions.at(-1)?.rateMinor, 9000);
  assert.deepEqual(changed.payments, cases.payments);
  const otherPractice = { ...cases, clientId: 'AM' };
  const original = structuredClone(otherPractice);
  assert.throws(() => applyClaraRateChange(otherPractice, scoped), /INVALID_RATE_CHANGE_POLICY/);
  assert.deepEqual(otherPractice, original);
});

test('invalid/ambiguous scope fails before changing anything', () => {
  const original = structuredClone(input);
  for (const eligible of [[], [{ sessionId: 'absent', clientId: 'person-a' }],
    [{ sessionId: 'effective', clientId: 'person-b' }], [policy.eligible[0], policy.eligible[0]]]) {
    assert.throws(() => applyClaraRateChange(input, { ...policy, eligible }), /INVALID_RATE_CHANGE/);
  }
  assert.deepEqual(input, original);
});

test('calendar date, version, integer amount and distinct schedule references are required', () => {
  for (const change of [
    { effectiveDate: '2026-02-30' }, { effectiveDate: '2026-10-01T00:00:00Z' }, { version: '' },
    { newStandardRate: { minor: 90.5, reference: 'standard-v2' } },
    { newStandardRate: { minor: -1, reference: 'standard-v2' } },
    { newStandardRate: { minor: 9000, reference: 'standard-v1' } },
    { newStandardRate: { minor: Number.MAX_SAFE_INTEGER + 1, reference: 'standard-v2' } },
  ]) assert.throws(() => applyClaraRateChange(input, { ...policy, ...change }), /INVALID_RATE_CHANGE_POLICY/);
  const leap = { ...input, sessions: [session('leap', '2028-02-29')] };
  assert.equal(applyClaraRateChange(leap, { ...policy, effectiveDate: '2028-02-29', eligible: [{ sessionId: 'leap', clientId: 'person-a' }] }).sessions[0].rateMinor, 9000);
});
