import {
  makeFunctionReference,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import type { GenericId } from "convex/values";

// Identity and role are derived by the backend; a selected tenant is not authority.
export type TenantId = GenericId<"tenants">;
export type Tenant = { _id: TenantId; name: string; role: "owner" | "viewer" };
export type Task = {
  _id: GenericId<"tasks">;
  title: string;
  completed: boolean;
  createdAt: number;
};
export type TaskList = { items: Task[]; hasMore: boolean; limit: number };
export const practiceApi = {
  services: makeFunctionReference<
    "query",
    { tenantId: TenantId; paginationOpts: PaginationOptions },
    PaginationResult<Service>
  >("services:list"),
  createService: makeFunctionReference<
    "mutation",
    ServiceInput & { tenantId: TenantId; requestKey: string },
    GenericId<"services">
  >("services:create"),
  clients: makeFunctionReference<
    "query",
    { tenantId: TenantId; paginationOpts: PaginationOptions },
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
export function readableError(error: unknown): string {
  const message = String(error);
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
  createdAt: number;
};
export type Client = {
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
