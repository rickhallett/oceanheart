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
};
export type TaskList = { items: Task[]; hasMore: boolean; limit: number };
export const practiceApi = {
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
  createTenant: makeFunctionReference<
    "mutation",
    { name: string; requestKey?: string },
    TenantId
  >("tenants:create"),
  tasks: makeFunctionReference<"query", { tenantId: TenantId }, TaskList>(
    "tasks:list",
  ),
  createTask: makeFunctionReference<
    "mutation",
    { tenantId: TenantId; title: string; requestKey: string },
    GenericId<"tasks">
  >("tasks:create"),
  setCompleted: makeFunctionReference<
    "mutation",
    { tenantId: TenantId; taskId: GenericId<"tasks">; completed: boolean },
    GenericId<"tasks">
  >("tasks:setCompleted"),
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
  if (message.includes("TIME_ZONE_REQUIRED"))
    return "Save the practice time zone before scheduling.";
  if (message.includes("BOOKING_CONFLICT"))
    return "That time overlaps an existing booking. Choose another time.";
  if (message.includes("LEGACY_BOOKING"))
    return "This older booking cannot be rescheduled. Cancel it and create a linked booking.";
  if (message.includes("BOOKING_CANCELLED"))
    return "This booking has been cancelled. Reload the practice to review its current state.";
  if (message.includes("INVALID_TIME_ZONE"))
    return "Enter a valid IANA time zone, such as Europe/London.";
  if (message.includes("ARCHIVED_RECORD") || message.includes("INACTIVE_"))
    return "The selected client or service is archived. Choose an active record.";
  if (message.includes("REVISION_CONFLICT"))
    return "This record has changed since you opened it. Reload the practice to review the latest version before editing again.";
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
export type Client = {
  archived: boolean;
  revision: number;
  _id: GenericId<"clients">;
  name: string;
  email?: string;
  phone?: string;
  createdAt: number;
};
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
};
