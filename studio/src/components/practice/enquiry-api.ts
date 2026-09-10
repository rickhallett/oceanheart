import {
  makeFunctionReference,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import type { GenericId } from "convex/values";
import type { TenantId, ClientInput } from "./api";
export type EnquiryId = GenericId<"enquiries">;
export type EnquirySummary = {
  _id: EnquiryId;
  name: string;
  subject: string;
  resolved: boolean;
  hasDraft: boolean;
  revision: number;
  createdAt: number;
  clientId?: GenericId<"clients">;
  bookingId?: GenericId<"bookings">;
};
export type Enquiry = EnquirySummary & {
  source?: {
    kind: "gmail";
    mailbox: string;
    messageId: string;
    truncated: boolean;
  };
  linkedClient?: { _id: GenericId<"clients">; name: string; archived: boolean };
  linkedBooking?: {
    _id: GenericId<"bookings">;
    startsAt: number;
    endsAt: number;
    status: "scheduled" | "cancelled";
    timeZone?: string;
    serviceName?: string;
  };
  email?: string;
  phone?: string;
  message: string;
  draft: string;
};
export type EnquiryInput = ClientInput & { subject: string; message: string };
export type Conversion = {
  client: { existingId: GenericId<"clients"> } | { create: ClientInput };
  booking?:
    | { existingId: GenericId<"bookings"> }
    | { create: { serviceId: GenericId<"services">; startsAt: number } };
};
export const enquiryApi = {
  list: makeFunctionReference<
    "query",
    {
      tenantId: TenantId;
      resolved?: boolean;
      paginationOpts: PaginationOptions;
    },
    PaginationResult<EnquirySummary>
  >("enquiries:list"),
  get: makeFunctionReference<
    "query",
    { tenantId: TenantId; enquiryId: EnquiryId },
    Enquiry
  >("enquiries:get"),
  create: makeFunctionReference<
    "mutation",
    EnquiryInput & { tenantId: TenantId; requestKey: string },
    EnquiryId
  >("enquiries:create"),
  saveDraft: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      enquiryId: EnquiryId;
      text: string;
      expectedRevision: number;
    },
    EnquiryId
  >("enquiries:saveDraft"),
  setResolved: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      enquiryId: EnquiryId;
      resolved: boolean;
      expectedRevision: number;
    },
    EnquiryId
  >("enquiries:setResolved"),
  convert: makeFunctionReference<
    "mutation",
    Conversion & {
      tenantId: TenantId;
      enquiryId: EnquiryId;
      expectedRevision: number;
      requestKey: string;
    },
    { clientId: GenericId<"clients">; bookingId?: GenericId<"bookings"> }
  >("enquiries:convert"),
};
