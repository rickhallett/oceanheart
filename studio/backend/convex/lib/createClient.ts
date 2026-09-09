import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { requireMember } from "./access";
import * as validate from "./catalog";
export async function createClient(ctx:MutationCtx,args:{tenantId:Id<"tenants">;name:string;email?:string;phone?:string;requestKey:string}) {
    const user=await requireMember(ctx,args.tenantId,true);
    const data=validate.clientFields(args),requestKey=validate.requestKey(args.requestKey),creationPayload=JSON.stringify(data);
    const existing=await ctx.db.query("clients").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",requestKey)).unique();
    if(existing){if((existing.creationPayload??JSON.stringify(validate.clientFields(existing)))!==creationPayload||existing.createdBy!==user.tokenIdentifier)throw new ConvexError("IDEMPOTENCY_MISMATCH");return existing._id;}
    return ctx.db.insert("clients",{tenantId:args.tenantId,...data,creationPayload,archived:false,searchText:validate.searchText(data.name,data.email),revision:0,createdAt:Date.now(),createdBy:user.tokenIdentifier,requestKey});
}
