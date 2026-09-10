import type { MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { requireMember } from "./access";
import { requestKey } from "./catalog";
import { requireBookingHours } from "./bookingHours";
export const MAX_DURATION=86400000;
export function interval(startsAt:number,endsAt:number){if(!Number.isSafeInteger(startsAt)||!Number.isSafeInteger(endsAt)||startsAt<0||endsAt>8640000000000000||endsAt<=startsAt||endsAt-startsAt>MAX_DURATION)throw new ConvexError("INVALID_INTERVAL");}
export async function free(ctx:MutationCtx,tenantId:Id<"tenants">,startsAt:number,endsAt:number,ignore?:Id<"bookings">){
  const overlap=await ctx.db.query("bookings").withIndex("by_tenant_start",q=>q.eq("tenantId",tenantId).gt("startsAt",startsAt-MAX_DURATION).lt("startsAt",endsAt)).filter(q=>q.and(q.gt(q.field("endsAt"),startsAt),q.neq(q.field("status"),"cancelled"),ignore?q.neq(q.field("_id"),ignore):q.eq(1,1))).first();
  if(overlap)throw new ConvexError("BOOKING_CONFLICT");
}
export function original(record:Doc<"bookings">){return record.creationPayload??JSON.stringify({practitionerId:record.practitionerId,startsAt:record.startsAt,endsAt:record.endsAt,clientLabel:record.clientLabel});}
export async function event(ctx:MutationCtx,record:Doc<"bookings">,actor:string,action:"created"|"rescheduled"|"cancelled",revision:number,startsAt=record.startsAt,endsAt=record.endsAt){
  await ctx.db.insert("bookingEvents",{tenantId:record.tenantId,bookingId:record._id,actor,action,revision,at:Date.now(),startsAt,endsAt,...(action==="rescheduled"?{previousStartsAt:record.startsAt,previousEndsAt:record.endsAt}:{})});
}
export async function createLinkedBooking(ctx:MutationCtx,args:{tenantId:Id<"tenants">;clientId:Id<"clients">;serviceId:Id<"services">;startsAt:number;requestKey:string}) {
    const user=await requireMember(ctx,args.tenantId,true);requestKey(args.requestKey);
    const creationPayload=JSON.stringify({clientId:args.clientId,serviceId:args.serviceId,startsAt:args.startsAt});
    const previous=await ctx.db.query("bookings").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",args.requestKey)).unique();
    if(previous){if(!previous.clientId||previous.creationPayload!==creationPayload||previous.createdBy!==user.tokenIdentifier)throw new ConvexError("IDEMPOTENCY_MISMATCH");return previous._id;}
    const tenant=await ctx.db.get(args.tenantId);if(!tenant?.timeZone)throw new ConvexError("TIME_ZONE_REQUIRED");
    const client=await ctx.db.get(args.clientId),service=await ctx.db.get(args.serviceId);
    if(!client||!service||client.tenantId!==args.tenantId||service.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");
    if(client.archived||!service.active)throw new ConvexError("ARCHIVED_RECORD");
    const endsAt=args.startsAt+service.durationMinutes*60000;interval(args.startsAt,endsAt);requireBookingHours(tenant,args.startsAt,endsAt);await free(ctx,args.tenantId,args.startsAt,endsAt);
    const serviceSnapshot={name:service.name,durationMinutes:service.durationMinutes,priceMinor:service.priceMinor,currency:service.currency};
    const id=await ctx.db.insert("bookings",{...args,endsAt,practitionerId:"practice",clientLabel:client.name,serviceSnapshot,timeZone:tenant.timeZone,creationPayload,status:"scheduled",revision:0,createdBy:user.tokenIdentifier});
    await event(ctx,(await ctx.db.get(id))!,user.tokenIdentifier,"created",0);return id;
}
