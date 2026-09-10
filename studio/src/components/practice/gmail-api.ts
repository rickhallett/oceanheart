import { makeFunctionReference } from "convex/server";
import type { TenantId } from "./api";
import type { EnquiryId } from "./enquiry-api";
export type GmailStatus = {
  connected: boolean;
  needsReconnect: boolean;
  mailbox?: string;
  generation: number;
};
export type GmailMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};
export type GmailPreview = GmailMessage & {
  from: string;
  subject: string;
  date: string;
  snippet: string;
  text: string;
  bodyTruncated: boolean;
  plainTextAvailable: boolean;
  hasAttachments: boolean;
};
export type RouteProof = { payload: string; signature: string };
export const gmailApi = {
  status: makeFunctionReference<"query", { tenantId: TenantId }, GmailStatus>(
    "gmailConnections:status",
  ),
  begin: makeFunctionReference<
    "action",
    { tenantId: TenantId; browserBinding: string; routeProof: RouteProof },
    { authorizationUrl: string; state: string }
  >("gmail:beginConnect"),
  complete: makeFunctionReference<
    "action",
    {
      state: string;
      browserBinding: string;
      code: string;
      routeProof: RouteProof;
    },
    { tenantId: TenantId; mailbox: string }
  >("gmail:completeConnect"),
  list: makeFunctionReference<
    "action",
    { tenantId: TenantId; pageToken?: string },
    { items: GmailMessage[]; nextPageToken?: string }
  >("gmail:listMessages"),
  preview: makeFunctionReference<
    "action",
    { tenantId: TenantId; messageId: string },
    GmailPreview
  >("gmail:previewMessage"),
  import: makeFunctionReference<
    "action",
    { tenantId: TenantId; messageId: string },
    { enquiryId: EnquiryId; alreadyImported: boolean }
  >("gmail:importMessage"),
  disconnect: makeFunctionReference<
    "action",
    { tenantId: TenantId },
    { disconnected: true; providerRevoked: boolean }
  >("gmail:disconnect"),
};
