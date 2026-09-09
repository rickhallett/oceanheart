import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import * as validate from "./lib/catalog";
export const create = mutation({
  args: {tenantId:v.id("tenants"),name:v.string(),durationMinutes:v.number(),priceMinor:v.number(),currency:v.literal("GBP"),description:v.optional(v.string()),requestKey:v.string()},
  handler: async (ctx,args) => {
    const user = await requireMember(ctx,args.tenantId,true);
    const name = validate.name(args.name), requestKey = validate.requestKey(args.requestKey);
    const description = validate.optional(args.description,2000,"INVALID_DESCRIPTION");
    if (!Number.isSafeInteger(args.durationMinutes) || args.durationMinutes < 1 || args.durationMinutes > 1440) throw new ConvexError("INVALID_DURATION");
    if (!Number.isSafeInteger(args.priceMinor) || args.priceMinor < 0 || args.priceMinor > 100000000) throw new ConvexError("INVALID_PRICE");
    const existing = await ctx.db.query("services").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",requestKey)).unique();
    if (existing) {
      if (existing.name !== name || existing.durationMinutes !== args.durationMinutes || existing.priceMinor !== args.priceMinor || existing.currency !== args.currency || existing.description !== description || existing.createdBy !== user.tokenIdentifier) throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return existing._id;
    }
    return ctx.db.insert("services",{tenantId:args.tenantId,name,durationMinutes:args.durationMinutes,priceMinor:args.priceMinor,currency:args.currency,...(description ? {description} : {}),active:true,createdAt:Date.now(),createdBy:user.tokenIdentifier,requestKey});
  },
});
export const list = query({
  args:{tenantId:v.id("tenants"),paginationOpts:paginationOptsValidator},
  handler:async(ctx,{tenantId,paginationOpts})=>{
    await requireMember(ctx,tenantId); validate.pageSize(paginationOpts.numItems);
    const result = await ctx.db.query("services").withIndex("by_tenant",q=>q.eq("tenantId",tenantId)).order("desc").paginate(paginationOpts);
    return {...result,page:result.page.map(({_id,name,durationMinutes,priceMinor,currency,description,active,createdAt})=>({_id,name,durationMinutes,priceMinor,currency,...(description ? {description} : {}),active,createdAt}))};
  },
});
