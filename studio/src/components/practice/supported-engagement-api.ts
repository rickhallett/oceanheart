import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import type { TenantId } from "./api";

export type KnowledgeUploadId = GenericId<"knowledgeUploads">;
export type KnowledgeSourceId = GenericId<"knowledgeSources">;
export type IngestionFormat = "text" | "markdown" | "pdf" | "docx";
export type IngestionErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_TEXT"
  | "UNREADABLE_SCAN"
  | "EXTRACTION_FAILED";

export const supportedEngagementApi = {
  access: makeFunctionReference<
    "query",
    { tenantId: TenantId },
    { capability: "read" | "contribute" | "owner" | null }
  >("knowledgeAccess:status"),
  changeSourceStatus: makeFunctionReference<
    "mutation",
    {
      tenantId: TenantId;
      sourceId: KnowledgeSourceId;
      expectedRevision: number;
      versionId: GenericId<"knowledgeVersions">;
      action: "approve" | "revoke" | "archive" | "delete";
    },
    number
  >("sourceLibrary:changeStatus"),
  upload: makeFunctionReference<
    "action",
    {
      tenantId: TenantId;
      bytes: ArrayBuffer;
      title: string;
      provenance: string;
      format: IngestionFormat;
      requestKey: string;
      targetSourceId?: KnowledgeSourceId;
      expectedRevision?: number;
    },
    { uploadId: KnowledgeUploadId }
  >("knowledgeIngestionActions:upload"),
  process: makeFunctionReference<
    "action",
    { tenantId: TenantId; uploadId: KnowledgeUploadId },
    KnowledgeSourceId
  >("knowledgeIngestionActions:process"),
  status: makeFunctionReference<
    "query",
    { tenantId: TenantId; uploadId: KnowledgeUploadId },
    {
      status: "pending" | "processing" | "ready" | "failed";
      errorCode?: IngestionErrorCode;
      sourceId?: KnowledgeSourceId;
    }
  >("knowledgeIngestion:status"),
};
