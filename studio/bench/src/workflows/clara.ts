/** Shared runtime/evaluation contract v1. All identities and records are synthetic. */
export interface ClaraInput {
  schemaVersion: 1;
  clientId: string;
  period: { from: string; to: string };
  sessions: Array<{
    id: string; clientId: string; date: string;
    attendance: 'attended' | 'cancelled' | 'unknown';
    rateMinor?: number; rateRef?: string;
    cancellationChargeMinor?: number; policyRef?: string;
    prepaid?: boolean; priorInvoiceId?: string;
  }>;
  payments?: Array<{ invoiceId: string; invoiceTotalMinor: number; receivedMinor: number }>;
}
export interface ClaraResult {
  schemaVersion: 1; clientId: string; currency: 'GBP'; draftId: string;
  lines: Array<{ sessionId: string; clientId: string; amountMinor: number; rateRef?: string; policyRef?: string }>;
  totalMinor: number;
  unresolved: Array<{ sessionId: string; reason: string }>;
  prepaidSessionIds: string[]; excludedSessionIds: string[];
  outstanding: Array<{ invoiceId: string; amountMinor: number }>;
}
export function calculateInvoice(input: ClaraInput, draftId = 'preview'): ClaraResult {
  validateInput(input);
  const result: ClaraResult = {schemaVersion:1,clientId:input.clientId,currency:'GBP',draftId,lines:[],totalMinor:0,unresolved:[],prepaidSessionIds:[],excludedSessionIds:[],outstanding:[]};
  for (const s of input.sessions) {
    if (s.date < input.period.from || s.date > input.period.to || s.priorInvoiceId) {result.excludedSessionIds.push(s.id);continue;}
    if (s.attendance === 'unknown') {result.unresolved.push({sessionId:s.id,reason:'Attendance is not confirmed'});continue;}
    if (s.prepaid && s.attendance === 'attended') {result.prepaidSessionIds.push(s.id);continue;}
    const amountMinor=s.attendance==='cancelled'?s.cancellationChargeMinor:s.rateMinor;
    const reference=s.attendance==='cancelled'?s.policyRef:s.rateRef;
    if (amountMinor===undefined || !reference) {result.unresolved.push({sessionId:s.id,reason:s.attendance==='cancelled'?'Cancellation charge and policy reference required':'Agreed rate and reference required'});continue;}
    result.lines.push({sessionId:s.id,clientId:s.clientId,amountMinor,...(s.attendance==='cancelled'?{policyRef:reference}:{rateRef:reference})});
    result.totalMinor+=amountMinor;
    if(!Number.isSafeInteger(result.totalMinor))throw Error('AMOUNT_OVERFLOW');
  }
  result.outstanding=(input.payments??[]).map(p=>({invoiceId:p.invoiceId,amountMinor:p.invoiceTotalMinor-p.receivedMinor}));
  return result;
}
function date(value: unknown): value is string { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }
function reference(value:unknown){return typeof value==='string' && value.length>0 && value.length<=200;}
function money(value: unknown) {if(!Number.isSafeInteger(value)|| (value as number)<0)throw Error('INVALID_AMOUNT');}
export function validateInput(input: ClaraInput): void {
  if(!input || input.schemaVersion!==1 || !/^[a-zA-Z0-9_-]{1,64}$/.test(input.clientId) || !date(input.period?.from)||!date(input.period?.to)||input.period.from>input.period.to||!Array.isArray(input.sessions)||input.sessions.length>1000)throw Error('INVALID_INPUT');
  const ids=new Set<string>();
  for(const s of input.sessions){
    if(!s || !reference(s.id)||ids.has(s.id)||!reference(s.clientId)||!date(s.date)||!['attended','cancelled','unknown'].includes(s.attendance))throw Error('INVALID_SESSION');
    ids.add(s.id);
    for(const value of [s.rateRef,s.policyRef,s.priorInvoiceId])if(value!==undefined&&!reference(value))throw Error("INVALID_REFERENCE");
    if(s.rateMinor!==undefined)money(s.rateMinor);
    if(s.cancellationChargeMinor!==undefined)money(s.cancellationChargeMinor);
    if(s.prepaid!==undefined&&typeof s.prepaid!=='boolean')throw Error('INVALID_SESSION');
  }
  if(input.payments!==undefined&&(!Array.isArray(input.payments)||input.payments.length>1000))throw Error("INVALID_PAYMENT");
  const invoices=new Set<string>();
  for(const p of input.payments??[]){if(!p||!reference(p.invoiceId)||invoices.has(p.invoiceId))throw Error('INVALID_PAYMENT');invoices.add(p.invoiceId);money(p.invoiceTotalMinor);money(p.receivedMinor);if(p.receivedMinor>p.invoiceTotalMinor)throw Error('OVERPAYMENT_REQUIRES_REVIEW');}
}
