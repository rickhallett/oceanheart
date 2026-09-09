import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import * as validate from "./lib/catalog";
export const create = mutation({
  args:{tenantId:v.id("tenants"),name:v.string(),email:v.optional(v.string()),phone:v.optional(v.string()),requestKey:v.string()},
  handler:async(ctx,args)=>{
    const user = await requireMember(ctx,args.tenantId,true);
    const name = validate.name(args.name), requestKey = validate.requestKey(args.requestKey);
    const email = validate.optional(args.email,254,"INVALID_EMAIL"), phone = validate.optional(args.phone,40,"INVALID_PHONE");
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(email))) throw new ConvexError("INVALID_EMAIL");
    if (phone && /[\p{Cc}\p{Zl}\p{Zp}]/u.test(phone)) throw new ConvexError("INVALID_PHONE");
    const existing = await ctx.db.query("clients").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",requestKey)).unique();
    if (existing) {
      if(existing.name !== name || existing.email !== email || existing.phone !== phone || existing.createdBy !== user.tokenIdentifier) throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return existing._id;
    }
    return ctx.db.insert("clients",{tenantId:args.tenantId,name,...(email ? {email}:{}),...(phone ? {phone}:{}),createdAt:Date.now(),createdBy:user.tokenIdentifier,requestKey});
  },
});
export const list = query({
  args:{tenantId:v.id("tenants"),paginationOpts:paginationOptsValidator},
  handler:async(ctx,{tenantId,paginationOpts})=>{
    await requireMember(ctx,tenantId,true); validate.pageSize(paginationOpts.numItems);
    const result = await ctx.db.query("clients").withIndex("by_tenant",q=>q.eq("tenantId",tenantId)).order("desc").paginate(paginationOpts);
    return {...result,page:result.page.map(({_id,name,email,phone,createdAt})=>({_id,name,...(email ? {email}:{}),...(phone ? {phone}:{}),createdAt}))};
  },
});
