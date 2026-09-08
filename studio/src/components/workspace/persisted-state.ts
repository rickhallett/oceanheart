import { initialState, modules, type State } from "./model";

type Check = (value: unknown) => boolean;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text: Check = (value) => typeof value === "string";
const number: Check = (value) =>
  typeof value === "number" && Number.isFinite(value);
const nonnegative: Check = (value) => number(value) && (value as number) >= 0;
const boolean: Check = (value) => typeof value === "boolean";
const optional =
  (check: Check): Check =>
  (value) =>
    value === undefined || check(value);
const oneOf =
  (...values: unknown[]): Check =>
  (value) =>
    values.includes(value);
const array =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const object =
  (fields: Record<string, Check>): Check =>
  (value) =>
    record(value) &&
    Object.entries(fields).every(([key, check]) => check(value[key]));
const strings = array(text);
const ids = { id: text };
const entities =
  (fields: Record<string, Check>): Check =>
  (value) =>
    array(object({ ...ids, ...fields }))(value) &&
    new Set((value as { id: string }[]).map((item) => item.id)).size ===
      (value as unknown[]).length;
const viewIds = modules.map(([id]) => id);
const viewMap =
  (check: Check): Check =>
  (value) =>
    record(value) &&
    Object.entries(value).every(
      ([key, item]) => viewIds.some((id) => id === key) && check(item),
    );
const checks: Record<keyof State, Check> = {
  practice: object({
    name: text,
    owner: text,
    email: text,
    modality: text,
    location: text,
    welcome: text,
    hours: text,
  }),
  clients: entities({
    name: text,
    email: text,
    phone: text,
    status: text,
    notes: strings,
  }),
  services: entities({
    name: text,
    duration: (v) => number(v) && (v as number) > 0,
    price: nonnegative,
    description: text,
    active: boolean,
  }),
  bookings: entities({
    clientId: text,
    serviceId: text,
    day: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
    time: (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
    status: oneOf("Confirmed", "Awaiting payment", "Cancelled", "Completed"),
  }),
  inbox: entities({
    clientId: text,
    subject: text,
    body: text,
    status: oneOf("New", "Draft ready", "Replied", "Escalated"),
    reply: text,
    messages: strings,
  }),
  tasks: entities({ text, done: boolean }),
  sources: entities({
    title: text,
    kind: text,
    audience: oneOf("Public", "Team only"),
    status: oneOf("Ready", "Needs sync"),
    content: text,
    version: (v) => Number.isInteger(v) && (v as number) > 0,
  }),
  approvals: entities({
    title: text,
    detail: text,
    type: oneOf("reply", "refund"),
    messageId: optional(text),
    paymentId: optional(text),
    status: oneOf("Pending", "Approved", "Declined"),
    amount: optional(nonnegative),
  }),
  payments: entities({
    clientId: text,
    description: text,
    amount: nonnegative,
    status: oneOf("Paid", "Pending", "Refunded"),
  }),
  tickets: entities({
    title: text,
    status: oneOf("Open", "In progress", "Resolved"),
    messages: strings,
  }),
  priorities: viewMap(
    oneOf("Unsorted", "Essential", "Next", "Later", "Not needed"),
  ),
  featureNotes: viewMap(text),
  connections: (v) => record(v) && Object.values(v).every(boolean),
  activity: strings,
  published: boolean,
  products: entities({
    name: text,
    price: nonnegative,
    stock: (v) => Number.isInteger(v) && (v as number) >= 0,
  }),
  orders: entities({
    clientId: text,
    item: text,
    status: oneOf("Processing", "Dispatched"),
  }),
  chatHistory: array(
    object({
      q: text,
      answer: text,
      sourceId: optional(text),
      citation: optional(
        object({
          id: text,
          title: text,
          version: (v) => Number.isInteger(v) && (v as number) > 0,
          content: text,
          audience: oneOf("Public", "Team only"),
        }),
      ),
      trace: strings,
    }),
  ),
  setupStep: (v) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 4,
  setupDescription: text,
  release: text,
};

/** Missing top-level fields may come from an older prototype. Validate every
 * resulting entity and relationship before admitting the snapshot as a unit. */
export function restoreState(value: unknown): State | null {
  if (!record(value)) return null;
  const candidate = { ...structuredClone(initialState), ...value };
  if (
    !Object.entries(checks).every(([key, check]) =>
      check(candidate[key as keyof State]),
    )
  )
    return null;
  const state = candidate as State;
  const clients = new Set(state.clients.map((item) => item.id));
  const services = new Set(state.services.map((item) => item.id));
  const messages = new Set(state.inbox.map((item) => item.id));
  const payments = new Set(state.payments.map((item) => item.id));
  if (
    state.bookings.some(
      (item) => !clients.has(item.clientId) || !services.has(item.serviceId),
    ) ||
    [...state.inbox, ...state.payments, ...state.orders].some(
      (item) => !clients.has(item.clientId),
    ) ||
    state.approvals.some(
      (item) =>
        (item.messageId !== undefined && !messages.has(item.messageId)) ||
        (item.paymentId !== undefined && !payments.has(item.paymentId)),
    )
  )
    return null;
  // Copy only known top-level fields; unexpected persisted keys are never imported.
  return Object.fromEntries(
    Object.keys(checks).map((key) => [key, state[key as keyof State]]),
  ) as State;
}
