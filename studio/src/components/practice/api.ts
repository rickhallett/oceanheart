import {
  makeFunctionReference,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import type { GenericId } from "convex/values";

// Identity and role are derived by the backend; a selected tenant is not authority.
export type TenantId = GenericId<"tenants">;
export type Tenant = {
  _id: TenantId;
  name: string;
  role: "owner" | "viewer";
  timeZone?: string;
};
export type Task = {
  _id: GenericId<"tasks">;
  title: string;
  completed: boolean;
  createdAt: number;
  revision: number;
  dueDate?: string;
  clientId?: GenericId<"clients">;
  clientName?: string;
  clientArchived?: boolean;
};
export type TaskClientOption = {
  _id: GenericId<"clients">;
  name: string;
  archived: boolean;
};
export type LinkedClient = { name: string; archived: boolean };
export type TaskFilter = "all" | "open" | "completed";
export type TaskUpdateResult = { taskId: GenericId<"tasks">; revision: number };
export type TaskList = { items: Task[]; hasMore: boolean; limit: number };
export type TodayStatus = { status: "setup_required" | "invalid_time_zone" };
export type TodayTaskList =
  | TodayStatus
  | ({
      status: "ready";
      day: string;
      timeZone: string;
      from: number;
      to: number;
      refreshAfterMs: number;
    } & TaskList);
export type TodayBookingList =
  | TodayStatus
  | {
      status: "ready";
      day: string;
      timeZone: string;
      from: number;
      to: number;
      refreshAfterMs: number;
      items: Booking[];
      hasMore: boolean;
      limit: number;
    };
export const practiceApi = {
  clientNotes: makeFunctionReference<
    "query", { tenantId: TenantId; clientId: GenericId<"clients"> }, ClientNotesValue
  >("clients:notes"),
  saveClientNotes: makeFunctionReference<
    "mutation", { tenantId: TenantId; clientId: GenericId<"clients">; text: string; expectedRevision: number }, ClientNotesValue
  >("clients:saveNotes"),
  clientBookings: makeFunctionReference<
    "query",
    { tenantId: TenantId; clientId: GenericId<"clients">; paginationOpts: PaginationOptions },
    PaginationResult<ClientBooking>
  >("bookings:forClient"),
  bookingHistory: makeFunctionReference<
    "query",
    { tenantId: TenantId; bookingId: GenericId<"bookings"> },
    { items: BookingEvent[]; hasMore: boolean; limit: number }
  >("bookings:history"),
  setTimeZone: makeFunctionReference<
    "mutation",
    { tenantId: TenantId; timeZone: string; expectedTimeZone: string | null },
    TenantId
  >("tenants:setTimeZone"),
  bookings: makeFunctionReference<
    "query",
    { tenantId: TenantId; from: number; to: number; practitionerId?: string },
    { items: Booking[]; hasMore: boolean; limit: number }
  >("bookings:list"),
  startBookingCheckout: makeFunctionReference<
    "action",
    {
      tenantId: TenantId;
      bookingId: GenericId<"bookings">;
      requestKey: string;
    },
    StartCheckoutResult
  >("payments:startCheckout"),
  paymentAvailability: makeFunctionReference<
    "query",
    { tenantId: TenantId },
    { enabled: boolean }
  >("payments:availability"),
  todayTasks: makeFunctionReference<
    "query",
    { tenantId: TenantId; refreshKey: number },
    TodayTaskList
  >("tasks:today"),
  todayBookings: makeFunctionReference<
    "query",
    { tenantId: TenantId; refreshKey: number },
    TodayBookingList
  >("bookings:today"),
  createBooking: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      clientId: GenericId<"clients">;
      serviceId: GenericId<"services">;
      startsAt: number;
      requestKey: string;
    },
    GenericId<"bookings">
  >("bookings:createLinked"),
  rescheduleBooking: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      bookingId: GenericId<"bookings">;
      startsAt: number;
      expectedRevision: number;
    },
    GenericId<"bookings">
  >("bookings:reschedule"),
  cancelBooking: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      bookingId: GenericId<"bookings">;
      expectedRevision: number;
    },
    GenericId<"bookings">
  >("bookings:cancel"),
  updateService: makeFunctionReference<
    "mutation",
    ServiceInput & {
      tenantId: TenantId;
      serviceId: GenericId<"services">;
      expectedRevision: number;
    },
    GenericId<"services">
  >("services:update"),
  archiveService: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      serviceId: GenericId<"services">;
      archived: boolean;
      expectedRevision: number;
    },
    GenericId<"services">
  >("services:setArchived"),
  updateClient: makeFunctionReference<
    "mutation",
    ClientInput & {
      tenantId: TenantId;
      clientId: GenericId<"clients">;
      expectedRevision: number;
    },
    GenericId<"clients">
  >("clients:update"),
  archiveClient: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      clientId: GenericId<"clients">;
      archived: boolean;
      expectedRevision: number;
    },
    GenericId<"clients">
  >("clients:setArchived"),
  services: makeFunctionReference<
    "query",
    {
      tenantId: TenantId;
      paginationOpts: PaginationOptions;
      archived?: boolean;
    },
    PaginationResult<Service>
  >("services:list"),
  createService: makeFunctionReference<
    "mutation",
    ServiceInput & { tenantId: TenantId; requestKey: string },
    GenericId<"services">
  >("services:create"),
  clients: makeFunctionReference<
    "query",
    {
      tenantId: TenantId;
      paginationOpts: PaginationOptions;
      archived?: boolean;
      search?: string;
    },
    PaginationResult<Client>
  >("clients:list"),
  createClient: makeFunctionReference<
    "mutation",
    ClientInput & { tenantId: TenantId; requestKey: string },
    GenericId<"clients">
  >("clients:create"),
  tenants: makeFunctionReference<"query", Record<string, never>, Tenant[]>(
    "tenants:list",
  ),
  settings: makeFunctionReference<
    "query",
    { tenantId: TenantId },
    PracticeSettings
  >("settings:get"),
  updateSettings: makeFunctionReference<
    "mutation",
    SettingsInput & {
      tenantId: TenantId;
      expectedRevision: number;
      expectedTimeZone: string | null;
    },
    number
  >("settings:update"),
  createTenant: makeFunctionReference<
    "mutation",
    { name: string; requestKey?: string },
    TenantId
  >("tenants:create"),
  tasks: makeFunctionReference<
    "query",
    { tenantId: TenantId; filter?: TaskFilter },
    TaskList
  >(
    "tasks:list",
  ),
  createTask: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      title: string;
      requestKey: string;
      dueDate?: string;
      clientId?: GenericId<"clients">;
    },
    GenericId<"tasks">
  >("tasks:create"),
  setCompleted: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      taskId: GenericId<"tasks">;
      completed: boolean;
      expectedRevision?: number;
    },
    GenericId<"tasks">
  >("tasks:setCompleted"),
  updateTask: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      taskId: GenericId<"tasks">;
      title: string;
      expectedRevision: number;
      dueDate?: string | null;
      clientId?: GenericId<"clients"> | null;
    },
    TaskUpdateResult
  >("tasks:update"),
  removeTask: makeFunctionReference<
    "mutation",
    { tenantId: TenantId; taskId: GenericId<"tasks">; expectedRevision: number },
    GenericId<"tasks">
  >("tasks:remove"),
};
export function hasErrorCode(error: unknown, code: string): boolean {
  const data =
    error && typeof error === "object" && "data" in error
      ? error.data
      : undefined;
  return (typeof data === "string" ? data : String(error)).includes(code);
}
export function readableError(error: unknown): string {
  const data =
    error && typeof error === "object" && "data" in error
      ? error.data
      : undefined;
  const message = typeof data === "string" ? data : String(error);
  if (
    message.includes("RECONNECT_REQUIRED") ||
    message.includes("GMAIL_NOT_CONNECTED")
  )
    return "Gmail access needs to be reconnected. Connect Gmail again, then retry.";
  if (message.includes("CONNECTION_CHANGED"))
    return "The Gmail connection changed. Reload before browsing or importing again.";
  if (message.includes("NO_PLAIN_TEXT"))
    return "This message has no plain-text body and cannot be imported.";
  if (message.includes("GMAIL_NOT_CONFIGURED"))
    return "Gmail connection is not configured for this environment.";
  if (message.includes("GMAIL_"))
    return "Gmail could not complete this request. Retry, or reconnect if access has expired.";
  if (message.includes("LINK_CONFLICT"))
    return "This enquiry is already linked to different records. Reload the practice to review its links.";
  if (message.includes("TIME_ZONE_REQUIRED"))
    return "Save the practice time zone before scheduling.";
  if (message.includes("INVALID_AVAILABILITY"))
    return "Give each open day a valid opening time before its closing time.";
  if (message.includes("INVALID_TAGLINE"))
    return "Keep the tagline to 200 characters without line breaks.";
  if (message.includes("INVALID_ADDRESS"))
    return "Keep the address to 500 characters without control characters.";
  if (message.includes("TIME_ZONE_CHANGED"))
    return "The practice time zone changed since you opened these settings. Load the latest settings before saving.";
  if (message.includes("BOOKING_CONFLICT"))
    return "That time overlaps an existing booking. Choose another time.";
  if (message.includes("OUTSIDE_PRACTICE_HOURS"))
    return "That appointment falls outside the practice’s saved weekly hours.";
  if (message.includes("LEGACY_BOOKING"))
    return "This older booking cannot be rescheduled. Cancel it and create a linked booking.";
  if (message.includes("BOOKING_CANCELLED"))
    return "This booking has been cancelled. Reload the practice to review its current state.";
  if (message.includes("PAYMENTS_NOT_CONFIGURED"))
    return "Test payments are not configured for this environment.";
  if (message.includes("PAYMENT_RECONCILIATION_REQUIRED"))
    return "This booking changed after payment started. Reconcile the existing payment before collecting again.";
  if (message.includes("PAYMENT_LINKED_BOOKING_REQUIRED"))
    return "Payment collection requires a linked client and service booking.";
  if (message.includes("PAYMENT_AMOUNT_REQUIRED"))
    return "This booking has no positive booked amount to collect.";
  if (message.includes("PAYMENT_ATTEMPT_FAILED"))
    return "The previous payment attempt failed. Retry from the current payment state.";
  if (message.includes("PAYMENT_"))
    return "Stripe could not confirm this test payment. Retry safely or review the payment state.";
  if (message.includes("INVALID_TIME_ZONE"))
    return "Enter a valid IANA time zone, such as Europe/London.";
  if (message.includes("ARCHIVED_RECORD") || message.includes("INACTIVE_"))
    return "The selected client or service is archived. Choose an active record.";
  if (message.includes("REVISION_CONFLICT"))
    return "This record has changed since you opened it. Reload the practice to review the latest version before editing again.";
  if (message.includes("INVALID_DUE_DATE"))
    return "Enter a real calendar date as YYYY-MM-DD.";
  if (message.includes("FORBIDDEN"))
    return "Your access to this practice has changed. Reload to check your permissions.";
  if (message.includes("UNAUTHENTICATED"))
    return "Your session has expired. Sign in again to continue.";
  if (message.includes("IDEMPOTENCY_MISMATCH"))
    return "This request was used with different details. Reload to check the saved list.";
  if (/INVALID_/.test(message)) return "Check the details and try again.";
  return "We couldn’t confirm the change. Retry with the same details to safely check or save it.";
}

export type Service = {
  _id: GenericId<"services">;
  name: string;
  durationMinutes: number;
  priceMinor: number;
  currency: "GBP";
  description?: string;
  active: boolean;
  revision: number;
  createdAt: number;
};
export type DayAvailability = { open: string; close: string } | null;
export type WeeklyAvailability = {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
};
export type PracticeSettings = {
  name: string;
  revision: number;
  timeZone?: string;
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  availability: WeeklyAvailability;
  enforceBookingHours: boolean;
};
export type SettingsInput = {
  name: string;
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  availability: WeeklyAvailability;
  enforceBookingHours?: boolean;
};
export type Client = {
  archived: boolean;
  revision: number;
  _id: GenericId<"clients">;
  name: string;
  email?: string;
  phone?: string;
  createdAt: number;
};
export type ClientNotesValue = { text: string; revision: number };
export type ServiceInput = {
  name: string;
  durationMinutes: number;
  priceMinor: number;
  currency: "GBP";
  description?: string;
};
export type ClientInput = { name: string; email?: string; phone?: string };

export type Booking = {
  _id: GenericId<"bookings">;
  startsAt: number;
  endsAt: number;
  clientLabel: string;
  clientId?: GenericId<"clients">;
  serviceId?: GenericId<"services">;
  serviceSnapshot?: {
    name: string;
    durationMinutes: number;
    priceMinor: number;
    currency: "GBP";
  };
  timeZone?: string;
  status: "scheduled" | "cancelled";
  revision: number;
  legacy: boolean;
  payment?: {
    attemptId: GenericId<"paymentAttempts">;
    status: "creating" | "pending" | "failed" | "paid";
    amountMinor: number;
    currency: "GBP";
    reconciliationRequired: boolean;
  };
};

export type StartCheckoutResult = {
  attemptId: GenericId<"paymentAttempts">;
  status: "creating" | "pending" | "failed" | "paid";
  checkoutUrl?: string;
};

export type ClientBooking = Pick<Booking, "_id" | "startsAt" | "endsAt" | "status" | "revision" | "serviceSnapshot" | "timeZone">;
export type BookingEvent = {
  action: "created" | "rescheduled" | "cancelled";
  at: number;
  revision: number;
  startsAt: number;
  endsAt: number;
  previousStartsAt?: number;
  previousEndsAt?: number;
};
