import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireKnowledgeAccess } from "./lib/knowledgeAccess";
import { requestKey } from "./lib/catalog";

const format = v.union(v.literal("text"), v.literal("markdown"), v.literal("pdf"), v.literal("docx"));
const errorCode = v.union(v.literal("FILE_TOO_LARGE"), v.literal("INVALID_TEXT"), v.literal("UNREADABLE_SCAN"), v.literal("EXTRACTION_FAILED"));

function details(titleValue: string, provenanceValue: string) {
  const title = titleValue.trim(), provenance = provenanceValue.trim();
  if (!title || title.length > 160 || provenance.length > 500 || /[\x00-\x1f]/.test(title + provenance))
    throw new ConvexError("INVALID_SOURCE_DETAILS");
  return { title, provenance };
}

export const registerOwned = internalMutation({
  args: { tenantId:v.id("tenants"), actor:v.string(), storageId:v.id("_storage"), title:v.string(), provenance:v.string(), format, requestKey:v.string(), targetSourceId:v.optional(v.id("knowledgeSources")), expectedRevision:v.optional(v.number()) },
  handler: async (ctx, args) => {
    requestKey(args.requestKey);
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata) throw new ConvexError("UPLOAD_NOT_FOUND");
    if (metadata.size > 5 * 1024 * 1024) throw new ConvexError("FILE_TOO_LARGE");
    const clean = details(args.title, args.provenance);
    if ((args.targetSourceId === undefined) !== (args.expectedRevision === undefined)) throw new ConvexError("INVALID_REPLACEMENT");
    const payload = JSON.stringify({ ...clean, format:args.format, targetSourceId:args.targetSourceId, expectedRevision:args.expectedRevision });
    const prior = await ctx.db.query("knowledgeUploads").withIndex("by_tenant_request", q => q.eq("tenantId",args.tenantId).eq("requestKey",args.requestKey)).unique();
    if (prior) {
      if (prior.actor !== args.actor || prior.payload !== payload) throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return { uploadId: prior._id, reused: true };
    }
    const now = Date.now();
    const uploadId = await ctx.db.insert("knowledgeUploads", { tenantId:args.tenantId, actor:args.actor, storageId:args.storageId, ...clean, format:args.format, targetSourceId:args.targetSourceId, expectedRevision:args.expectedRevision, status:"pending", requestKey:args.requestKey, payload, createdAt:now, updatedAt:now });
    return { uploadId, reused: false };
  },
});

export const status = query({
  args:{tenantId:v.id("tenants"),uploadId:v.id("knowledgeUploads")},
  handler:async(ctx,args)=>{await requireKnowledgeAccess(ctx,args.tenantId,"read");const row=await ctx.db.get(args.uploadId);if(!row||row.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");return {status:row.status,errorCode:row.errorCode,sourceId:row.sourceId};},
});

export const claim = internalMutation({
  args:{tenantId:v.id("tenants"),uploadId:v.id("knowledgeUploads"),actor:v.string()},
  handler:async(ctx,args)=>{const row=await ctx.db.get(args.uploadId);if(!row||row.tenantId!==args.tenantId||row.actor!==args.actor)throw new ConvexError("FORBIDDEN");const grant=await ctx.db.query("knowledgeAccessGrants").withIndex("by_tenant_identity",q=>q.eq("tenantId",row.tenantId).eq("identity",args.actor)).unique();const membership=await ctx.db.query("memberships").withIndex("by_tenant_identity",q=>q.eq("tenantId",row.tenantId).eq("identity",args.actor)).unique();if(membership?.role!=="owner"&&(!grant?.active||grant.capability!=="contribute"))throw new ConvexError("FORBIDDEN");if(row.status==="ready")return row;if(row.status==="failed")throw new ConvexError("UPLOAD_FAILED");await ctx.db.patch(row._id,{status:"processing",updatedAt:Date.now()});return row;},
});

export const complete = internalMutation({
  args:{uploadId:v.id("knowledgeUploads"),actor:v.string(),content:v.string(),hash:v.string()},
  handler:async(ctx,args)=>{const row=await ctx.db.get(args.uploadId);if(!row||row.actor!==args.actor||row.status!=="processing")throw new ConvexError("UPLOAD_STATE_CHANGED");const grant=await ctx.db.query("knowledgeAccessGrants").withIndex("by_tenant_identity",q=>q.eq("tenantId",row.tenantId).eq("identity",args.actor)).unique();const membership=await ctx.db.query("memberships").withIndex("by_tenant_identity",q=>q.eq("tenantId",row.tenantId).eq("identity",args.actor)).unique();if(membership?.role!=="owner"&&(!grant?.active||grant.capability!=="contribute"))throw new ConvexError("FORBIDDEN");if(row.targetSourceId){const source=await ctx.db.get(row.targetSourceId);if(!source||source.tenantId!==row.tenantId)throw new ConvexError("FORBIDDEN");if(source.archived)throw new ConvexError("SOURCE_ARCHIVED");if(source.revision!==row.expectedRevision)throw new ConvexError("REVISION_CONFLICT");const current=source.currentVersionId?await ctx.db.get(source.currentVersionId):null;if(!current||current.sourceId!==source._id||current.tenantId!==row.tenantId)throw new ConvexError("INVALID_SOURCE_VERSION");const versionId=await ctx.db.insert("knowledgeVersions",{tenantId:row.tenantId,sourceId:source._id,title:row.title,provenance:row.provenance,format:row.format==="markdown"?"markdown":"text",content:args.content,hash:args.hash,number:current.number+1,createdBy:args.actor,requestKey:row.requestKey,payload:row.payload});await ctx.db.patch(source._id,{title:row.title,provenance:row.provenance,format:row.format==="markdown"?"markdown":"text",currentVersionId:versionId,approvedVersionId:undefined,revision:source.revision+1,lastAction:undefined});await ctx.db.patch(row._id,{status:"ready",sourceId:source._id,updatedAt:Date.now()});return source._id;}const prior=await ctx.db.query("knowledgeSources").withIndex("by_tenant_request",q=>q.eq("tenantId",row.tenantId).eq("requestKey",row.requestKey)).unique();if(prior){if(prior.createdBy!==args.actor)throw new ConvexError("IDEMPOTENCY_MISMATCH");await ctx.db.patch(row._id,{status:"ready",sourceId:prior._id,updatedAt:Date.now()});return prior._id;}const sourceId=await ctx.db.insert("knowledgeSources",{tenantId:row.tenantId,title:row.title,provenance:row.provenance,format:row.format==="markdown"?"markdown":"text",audience:"owner",archived:false,revision:0,createdBy:args.actor,requestKey:row.requestKey,creationPayload:row.payload});const versionId=await ctx.db.insert("knowledgeVersions",{tenantId:row.tenantId,sourceId,title:row.title,provenance:row.provenance,format:row.format==="markdown"?"markdown":"text",content:args.content,hash:args.hash,number:1,createdBy:args.actor,requestKey:row.requestKey,payload:row.payload});await ctx.db.patch(sourceId,{currentVersionId:versionId});await ctx.db.patch(row._id,{status:"ready",sourceId,updatedAt:Date.now()});return sourceId;},
});

export const fail = internalMutation({args:{uploadId:v.id("knowledgeUploads"),actor:v.string(),errorCode},handler:async(ctx,args)=>{const row=await ctx.db.get(args.uploadId);if(!row||row.actor!==args.actor||row.status==="ready")throw new ConvexError("UPLOAD_STATE_CHANGED");await ctx.storage.delete(row.storageId);await ctx.db.patch(row._id,{status:"failed",errorCode:args.errorCode,updatedAt:Date.now()});}});

export const authorised = internalQuery({args:{tenantId:v.id("tenants"),identity:v.string()},handler:async(ctx,args)=>{const membership=await ctx.db.query("memberships").withIndex("by_tenant_identity",q=>q.eq("tenantId",args.tenantId).eq("identity",args.identity)).unique();if(membership?.role==="owner")return true;const grant=await ctx.db.query("knowledgeAccessGrants").withIndex("by_tenant_identity",q=>q.eq("tenantId",args.tenantId).eq("identity",args.identity)).unique();return grant?.active===true&&grant.capability==="contribute";}});
