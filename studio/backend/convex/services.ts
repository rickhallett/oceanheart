import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import * as validate from "./lib/catalog";
const fields={name:v.string(),durationMinutes:v.number(),priceMinor:v.number(),currency:v.literal("GBP"),description:v.optional(v.string())};
export const create=mutation({
  args:{tenantId:v.id("tenants"),...fields,requestKey:v.string()},
  handler:async(ctx,args)=>{
    const user=await requireMember(ctx,args.tenantId,true);
    const data=validate.serviceFields(args),requestKey=validate.requestKey(args.requestKey),creationPayload=JSON.stringify(data);
    const existing=await ctx.db.query("services").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",requestKey)).unique();
    if(existing){if((existing.creationPayload??JSON.stringify(validate.serviceFields(existing)))!==creationPayload||existing.createdBy!==user.tokenIdentifier)throw new ConvexError("IDEMPOTENCY_MISMATCH");return existing._id;}
    return ctx.db.insert("services",{tenantId:args.tenantId,...data,creationPayload,active:true,revision:0,createdAt:Date.now(),createdBy:user.tokenIdentifier,requestKey});
  },
});
export const update=mutation({
  args:{tenantId:v.id("tenants"),serviceId:v.id("services"),...fields,expectedRevision:v.number()},
  handler:async(ctx,args)=>{
    await requireMember(ctx,args.tenantId,true); validate.expectedRevision(args.expectedRevision);
    const data=validate.serviceFields(args),record=await ctx.db.get(args.serviceId);
    if(!record||record.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");
    const oldPayload=JSON.stringify(validate.serviceFields(record));
    if(oldPayload===JSON.stringify(data))return record._id;
    if((record.revision??0)!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(record._id,{...data,creationPayload:record.creationPayload??oldPayload,revision:(record.revision??0)+1});return record._id;
  },
});
export const setArchived=mutation({
  args:{tenantId:v.id("tenants"),serviceId:v.id("services"),archived:v.boolean(),expectedRevision:v.number()},
  handler:async(ctx,args)=>{
    await requireMember(ctx,args.tenantId,true);validate.expectedRevision(args.expectedRevision);
    const record=await ctx.db.get(args.serviceId);if(!record||record.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");
    if(record.active===!args.archived)return record._id;
    if((record.revision??0)!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(record._id,{active:!args.archived,revision:(record.revision??0)+1});return record._id;
  },
});
export const list=query({
  args:{tenantId:v.id("tenants"),archived:v.optional(v.boolean()),paginationOpts:paginationOptsValidator},
  handler:async(ctx,{tenantId,archived=false,paginationOpts})=>{
    await requireMember(ctx,tenantId);validate.pageSize(paginationOpts.numItems);
    const result=await ctx.db.query("services").withIndex("by_tenant_active",q=>q.eq("tenantId",tenantId).eq("active",!archived)).order("desc").paginate(paginationOpts);
    return {...result,page:result.page.map(({_id,name,durationMinutes,priceMinor,currency,description,active,createdAt,revision})=>({_id,name,durationMinutes,priceMinor,currency,...(description?{description}:{}),active,createdAt,revision:revision??0}))};
  },
});
