import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { proposalReference } from "./lib/actionContract";
import { expectedRevision, requestKey } from "./lib/catalog";
import { requireMember } from "./lib/access";

type Ctx = QueryCtx | MutationCtx;
type Reference = { sourceId: Id<"knowledgeSources">; versionId: Id<"knowledgeVersions">; hash: string };

const decision = v.union(v.literal("accept"), v.literal("request_changes"));

function text(value: string, max: number, required = true) {
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized))
    throw new ConvexError("INVALID_WORKFLOW_BRIEF");
  return normalized;
}

function isDeleted(source: Doc<"knowledgeSources">) {
  return "deletedAt" in source && typeof source.deletedAt === "number";
}

async function approvedReferences(ctx: Ctx, tenantId: Id<"tenants">, sourceIds: Id<"knowledgeSources">[]) {
  if (!sourceIds.length || sourceIds.length > 5 || new Set(sourceIds).size !== sourceIds.length)
    throw new ConvexError("INVALID_WORKFLOW_BRIEF");
  const references: Reference[] = [];
  for (const sourceId of sourceIds) {
    const source = await ctx.db.get(sourceId);
    if (!source || source.tenantId !== tenantId || source.archived || isDeleted(source) ||
        !source.currentVersionId || source.approvedVersionId !== source.currentVersionId)
      throw new ConvexError("EVIDENCE_UNAVAILABLE");
    const version = await ctx.db.get(source.currentVersionId);
    if (!version || version.tenantId !== tenantId || version.sourceId !== sourceId)
      throw new ConvexError("EVIDENCE_UNAVAILABLE");
    references.push({ sourceId, versionId: version._id, hash: version.hash });
  }
  return references;
}

async function evidence(ctx: Ctx, tenantId: Id<"tenants">, references: Reference[]) {
  const items: { sourceId: Id<"knowledgeSources">; title: string; version: number }[] = [];
  let current = true;
  for (const reference of references) {
    const source = await ctx.db.get(reference.sourceId);
    const version = await ctx.db.get(reference.versionId);
    if (!source || !version || source.tenantId !== tenantId || version.tenantId !== tenantId ||
        version.sourceId !== source._id || source.archived || isDeleted(source) ||
        source.currentVersionId !== version._id || source.approvedVersionId !== version._id ||
        version.hash !== reference.hash) current = false;
    if (source && version && source.tenantId === tenantId && version.tenantId === tenantId)
      items.push({ sourceId: source._id, title: source.title, version: version.number });
  }
  return { evidenceState: current ? "current" as const : "unavailable" as const, evidence: items };
}

async function present(ctx: Ctx, brief: Doc<"workflowBriefs">) {
  return {
    id: brief._id,
    title: brief.title,
    outcome: brief.outcome,
    reviewNotes: brief.reviewNotes,
    status: brief.status,
    revision: brief.revision,
    ...(await evidence(ctx, brief.tenantId, brief.references)),
  };
}

export const eligible = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    await requireMember(ctx, tenantId, true);
    const sources = await ctx.db.query("knowledgeSources").withIndex("by_tenant_archived", q => q.eq("tenantId", tenantId).eq("archived", false)).take(25);
    const result = [];
    for (const source of sources) {
      if (!source.currentVersionId || source.approvedVersionId !== source.currentVersionId || isDeleted(source)) continue;
      const version = await ctx.db.get(source.currentVersionId);
      if (version && version.tenantId === tenantId && version.sourceId === source._id)
        result.push({ sourceId: source._id, title: source.title, version: version.number });
    }
    return result;
  },
});

export const prepare = mutation({
  args: { tenantId:v.id("tenants"), title:v.string(), outcome:v.string(), reviewNotes:v.string(), sourceIds:v.array(v.id("knowledgeSources")), requestKey:v.string() },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx, args.tenantId, true);
    const key = requestKey(args.requestKey);
    const fields = { title:text(args.title,160), outcome:text(args.outcome,1000), reviewNotes:text(args.reviewNotes,2000,false) };
    const payload = JSON.stringify({ ...fields, sourceIds:args.sourceIds });
    const existing = await ctx.db.query("workflowBriefs").withIndex("by_tenant_request", q => q.eq("tenantId",args.tenantId).eq("requestKey",key)).unique();
    if (existing) {
      if (existing.actor !== user.tokenIdentifier || existing.creationPayload !== payload) throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return existing._id;
    }
    const references = await approvedReferences(ctx, args.tenantId, args.sourceIds);
    return ctx.db.insert("workflowBriefs", { tenantId:args.tenantId, actor:user.tokenIdentifier, version:1, ...fields, references, status:"draft", revision:0, requestKey:key, creationPayload:payload, createdAt:Date.now() });
  },
});

export const get = query({
  args: { tenantId:v.id("tenants"), briefId:v.id("workflowBriefs") },
  handler: async (ctx, { tenantId, briefId }) => {
    await requireMember(ctx, tenantId, true);
    const brief = await ctx.db.get(briefId);
    if (!brief || brief.tenantId !== tenantId) throw new ConvexError("WORKFLOW_BRIEF_NOT_FOUND");
    return present(ctx, brief);
  },
});

export const latest = query({
  args: { tenantId:v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    await requireMember(ctx, tenantId, true);
    const brief = await ctx.db.query("workflowBriefs").withIndex("by_tenant", q => q.eq("tenantId",tenantId)).order("desc").first();
    return brief ? present(ctx, brief) : null;
  },
});

export const review = mutation({
  args: { tenantId:v.id("tenants"), briefId:v.id("workflowBriefs"), expectedRevision:v.number(), decision, requestKey:v.string() },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx, args.tenantId, true);
    expectedRevision(args.expectedRevision);
    const key = requestKey(args.requestKey);
    const brief = await ctx.db.get(args.briefId);
    if (!brief || brief.tenantId !== args.tenantId) throw new ConvexError("WORKFLOW_BRIEF_NOT_FOUND");
    const payload = JSON.stringify({ decision:args.decision, expectedRevision:args.expectedRevision });
    if (brief.reviewRequestKey === key) {
      if (brief.reviewPayload !== payload) throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return { status:brief.status, revision:brief.revision };
    }
    if (brief.status !== "draft") throw new ConvexError("WORKFLOW_BRIEF_ALREADY_REVIEWED");
    if (brief.revision !== args.expectedRevision) throw new ConvexError("REVISION_CONFLICT");
    if ((await evidence(ctx, args.tenantId, brief.references)).evidenceState !== "current") throw new ConvexError("EVIDENCE_UNAVAILABLE");
    const status = args.decision === "accept" ? "accepted" as const : "changes_requested" as const;
    await ctx.db.patch(brief._id, { status, revision:brief.revision+1, reviewedAt:Date.now(), reviewedBy:user.tokenIdentifier, reviewRequestKey:key, reviewPayload:payload });
    return { status, revision:brief.revision+1 };
  },
});
