import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireKnowledgeAccess } from "./lib/knowledgeAccess";
import { requestKey, expectedRevision } from "./lib/catalog";

const fields = {
  title: v.string(),
  provenance: v.string(),
  format: v.union(v.literal("text"), v.literal("markdown")),
  content: v.string(),
};
async function validated(args: {
  title: string;
  provenance: string;
  format: "text" | "markdown";
  content: string;
}) {
  const title = args.title.trim(),
    provenance = args.provenance.trim();
  if (
    !title ||
    title.length > 160 ||
    provenance.length > 500 ||
    /[\x00-\x1f]/.test(title + provenance)
  )
    throw new ConvexError("INVALID_SOURCE_DETAILS");
  if (
    !args.content.trim() ||
    new TextEncoder().encode(args.content).length > 32768 ||
    args.content.includes("\0")
  )
    throw new ConvexError("INVALID_SOURCE_CONTENT");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(args.content),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return {
    title,
    provenance,
    format: args.format,
    content: args.content,
    hash,
  };
}
async function owned(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  sourceId: Id<"knowledgeSources">,
  capability: "read" | "contribute" = "read",
) {
  const actor = await requireKnowledgeAccess(ctx, tenantId, capability),
    source = await ctx.db.get(sourceId);
  if (!source || source.tenantId !== tenantId)
    throw new ConvexError("FORBIDDEN");
  return { actor, source };
}
async function currentVersion(ctx: QueryCtx, source: Doc<"knowledgeSources">) {
  const version = source.currentVersionId
    ? await ctx.db.get(source.currentVersionId)
    : null;
  if (
    !version ||
    version.tenantId !== source.tenantId ||
    version.sourceId !== source._id
  )
    throw new ConvexError("INVALID_SOURCE_VERSION");
  return version;
}
export const list = query({
  args: {
    tenantId: v.id("tenants"),
    archived: v.boolean(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireKnowledgeAccess(ctx, args.tenantId, "read");
    const result = await ctx.db
      .query("knowledgeSources")
      .withIndex("by_tenant_archived_deleted", (q) =>
        q.eq("tenantId", args.tenantId).eq("archived", args.archived).eq("deletedAt", undefined),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(25, Math.max(1, args.paginationOpts.numItems)),
      });
    return {
      ...result,
      page: result.page.map(({ creationPayload, ...metadata }) => metadata),
    };
  },
});
export const get = query({
  args: { tenantId: v.id("tenants"), sourceId: v.id("knowledgeSources") },
  handler: async (ctx, args) => {
    const { source } = await owned(ctx, args.tenantId, args.sourceId);
    const version = await currentVersion(ctx, source);
    return { source, version };
  },
});
export const versions = query({
  args: {
    tenantId: v.id("tenants"),
    sourceId: v.id("knowledgeSources"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await owned(ctx, args.tenantId, args.sourceId);
    const result = await ctx.db
      .query("knowledgeVersions")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(10, Math.max(1, args.paginationOpts.numItems)),
      });
    return {
      ...result,
      page: result.page.map(({ content, payload, ...metadata }) => metadata),
    };
  },
});
export const version = query({
  args: {
    tenantId: v.id("tenants"),
    sourceId: v.id("knowledgeSources"),
    versionId: v.id("knowledgeVersions"),
  },
  handler: async (ctx, args) => {
    await owned(ctx, args.tenantId, args.sourceId);
    const version = await ctx.db.get(args.versionId);
    if (
      !version ||
      version.tenantId !== args.tenantId ||
      version.sourceId !== args.sourceId
    )
      throw new ConvexError("FORBIDDEN");
    return version;
  },
});
export const create = mutation({
  args: { tenantId: v.id("tenants"), requestKey: v.string(), ...fields },
  handler: async (ctx, args) => {
    const actor = await requireKnowledgeAccess(ctx, args.tenantId, "contribute");
    requestKey(args.requestKey);
    const data = await validated(args),
      payload = JSON.stringify(data);
    const prior = await ctx.db
      .query("knowledgeSources")
      .withIndex("by_tenant_request", (q) =>
        q.eq("tenantId", args.tenantId).eq("requestKey", args.requestKey),
      )
      .unique();
    if (prior) {
      if (
        prior.creationPayload !== payload ||
        prior.createdBy !== actor.tokenIdentifier
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return prior._id;
    }
    const sourceId = await ctx.db.insert("knowledgeSources", {
      tenantId: args.tenantId,
      title: data.title,
      provenance: data.provenance,
      format: data.format,
      audience: "owner",
      archived: false,
      revision: 0,
      createdBy: actor.tokenIdentifier,
      requestKey: args.requestKey,
      creationPayload: payload,
    });
    const versionId = await ctx.db.insert("knowledgeVersions", {
      tenantId: args.tenantId,
      sourceId,
      ...data,
      number: 1,
      createdBy: actor.tokenIdentifier,
      requestKey: args.requestKey,
      payload,
    });
    await ctx.db.patch(sourceId, { currentVersionId: versionId });
    return sourceId;
  },
});
export const save = mutation({
  args: {
    tenantId: v.id("tenants"),
    sourceId: v.id("knowledgeSources"),
    expectedRevision: v.number(),
    requestKey: v.string(),
    ...fields,
  },
  handler: async (ctx, args) => {
    const { source, actor } = await owned(ctx, args.tenantId, args.sourceId, "contribute");
    const current = await currentVersion(ctx, source);
    expectedRevision(args.expectedRevision);
    requestKey(args.requestKey);
    const data = await validated(args),
      payload = JSON.stringify({
        ...data,
        expectedRevision: args.expectedRevision,
      });
    const prior = await ctx.db
      .query("knowledgeVersions")
      .withIndex("by_source_request", (q) =>
        q.eq("sourceId", args.sourceId).eq("requestKey", args.requestKey),
      )
      .unique();
    if (prior) {
      if (
        prior.payload !== payload ||
        prior.createdBy !== actor.tokenIdentifier
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return prior._id;
    }
    if (source.archived) throw new ConvexError("SOURCE_ARCHIVED");
    if (source.revision !== args.expectedRevision)
      throw new ConvexError("REVISION_CONFLICT");
    const versionId = await ctx.db.insert("knowledgeVersions", {
      tenantId: args.tenantId,
      sourceId: args.sourceId,
      ...data,
      number: current.number + 1,
      createdBy: actor.tokenIdentifier,
      requestKey: args.requestKey,
      payload,
    });
    await ctx.db.patch(source._id, {
      title: data.title,
      provenance: data.provenance,
      format: data.format,
      currentVersionId: versionId,
      approvedVersionId: undefined,
      revision: source.revision + 1,
      lastAction: undefined,
    });
    return versionId;
  },
});
export const changeStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    sourceId: v.id("knowledgeSources"),
    expectedRevision: v.number(),
    versionId: v.id("knowledgeVersions"),
    action: v.union(
      v.literal("approve"),
      v.literal("revoke"),
      v.literal("archive"),
      v.literal("delete"),
    ),
  },
  handler: async (ctx, args) => {
    await requireKnowledgeAccess(ctx, args.tenantId, "approve");
    const { source } = await owned(ctx, args.tenantId, args.sourceId);
    expectedRevision(args.expectedRevision);
    const actionKey = JSON.stringify({
      action: args.action,
      versionId: args.versionId,
      revision: args.expectedRevision,
    });
    if (
      source.revision === args.expectedRevision + 1 &&
      source.lastAction === actionKey
    )
      return source.revision;
    await currentVersion(ctx, source);
    if (
      source.revision !== args.expectedRevision ||
      source.currentVersionId !== args.versionId
    )
      throw new ConvexError("REVISION_CONFLICT");
    if (source.archived && args.action !== "delete") throw new ConvexError("SOURCE_ARCHIVED");
    if (args.action === "delete") {
      const versions = await ctx.db.query("knowledgeVersions").withIndex("by_source", q => q.eq("sourceId", source._id)).collect();
      const completedUploads = await ctx.db.query("knowledgeUploads").withIndex("by_source", q => q.eq("sourceId", source._id)).collect();
      const replacementUploads = await ctx.db.query("knowledgeUploads").withIndex("by_target_source", q => q.eq("targetSourceId", source._id)).collect();
      const uploads = [...new Map([...completedUploads, ...replacementUploads].map(upload => [upload._id, upload])).values()];
      for (const version of versions) await ctx.db.delete(version._id);
      for (const upload of uploads) {
        await ctx.storage.delete(upload.storageId);
        await ctx.db.delete(upload._id);
      }
    }
    await ctx.db.patch(source._id, {
      approvedVersionId: args.action === "approve" ? args.versionId : undefined,
      archived: args.action === "archive" || args.action === "delete",
      deletedAt: args.action === "delete" ? Date.now() : source.deletedAt,
      currentVersionId: args.action === "delete" ? undefined : source.currentVersionId,
      title: args.action === "delete" ? "Deleted document" : source.title,
      provenance: args.action === "delete" ? "" : source.provenance,
      creationPayload: args.action === "delete" ? "deleted" : source.creationPayload,
      revision: source.revision + 1,
      lastAction: actionKey,
    });
    return source.revision + 1;
  },
});
