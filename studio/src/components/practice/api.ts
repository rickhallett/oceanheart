import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";

// Small explicit frontend contract. The backend derives identity from the JWT;
// neither identity nor a role is accepted as a mutation argument.
export type TenantId = GenericId<"tenants">;
export type Tenant = { _id: TenantId; name: string; role: "owner" | "viewer" };
export type Booking = {
  _id: GenericId<"bookings">;
  tenantId: TenantId;
  practitionerId: string;
  startsAt: number;
  endsAt: number;
  clientLabel: string;
};
export type BookingInput = {
  tenantId: TenantId;
  practitionerId: string;
  startsAt: number;
  endsAt: number;
  clientLabel: string;
  requestKey: string;
};
export const practiceApi = {
  tenants: makeFunctionReference<"query", Record<string, never>, Tenant[]>(
    "tenants:list",
  ),
  createTenant: makeFunctionReference<"mutation", { name: string }, TenantId>(
    "tenants:create",
  ),
  bookings: makeFunctionReference<
    "query",
    { tenantId: TenantId; practitionerId: string; from: number; to: number },
    { items: Booking[]; hasMore: boolean; limit: number }
  >("bookings:list"),
  createBooking: makeFunctionReference<
    "mutation",
    BookingInput,
    GenericId<"bookings">
  >("bookings:create"),
};

export function readableError(error: unknown): string {
  const message = String(error);
  if (message.includes("BOOKING_CONFLICT"))
    return "That time is already booked. Choose another time and try again.";
  if (message.includes("IDEMPOTENCY_MISMATCH"))
    return "This request has already been used for different details. Review the bookings before starting again.";
  if (message.includes("FORBIDDEN"))
    return "Your access to this practice has changed. Refresh to check your current permissions.";
  if (message.includes("UNAUTHENTICATED"))
    return "Your session needs to be refreshed. Sign in again to continue.";
  if (/INVALID_/.test(message)) return "Check the details and try again.";
  return "We couldn’t confirm the change. Check the list before retrying; your request will keep the same reference.";
}
export function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function dayWindow(day: string) {
  const from = new Date(`${day}T00:00:00`).getTime();
  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { from, to: tomorrow.getTime() };
}
