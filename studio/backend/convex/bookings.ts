import { MAX_DURATION, interval, free, original, event, createLinkedBooking } from "./lib/bookingCommands";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import { expectedRevision, requestKey } from "./lib/catalog";
import { practiceDayAt } from "./lib/practiceDay";
import { paginationOptsValidator } from "convex/server";
import { pageSize } from "./lib/catalog";
import { requireBookingHours } from "./lib/bookingHours";

export const forClient = query({
  args: { tenantId: v.id("tenants"), clientId: v.id("clients"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { tenantId, clientId, paginationOpts }) => {
    await requireMember(ctx, tenantId, true);
    const client = await ctx.db.get(clientId);
    if (!client || client.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    pageSize(paginationOpts.numItems);
    const result = await ctx.db.query("bookings")
      .withIndex("by_tenant_client_start", q => q.eq("tenantId", tenantId).eq("clientId", clientId))
      .order("desc").paginate(paginationOpts);
    return { ...result, page: result.page.map(r => ({
      _id: r._id, startsAt: r.startsAt, endsAt: r.endsAt,
      status: r.status ?? "scheduled", revision: r.revision ?? 0,
      ...(r.serviceSnapshot ? { serviceSnapshot: r.serviceSnapshot } : {}),
      ...(r.timeZone ? { timeZone: r.timeZone } : {}),
    })) };
  },
});
export const create=mutation({
  args:{tenantId:v.id("tenants"),practitionerId:v.string(),startsAt:v.number(),endsAt:v.number(),clientLabel:v.string(),requestKey:v.string()},
  handler:async(ctx,args)=>{
    const user=await requireMember(ctx,args.tenantId,true);interval(args.startsAt,args.endsAt);requestKey(args.requestKey);
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(args.practitionerId)||!args.clientLabel.trim()||args.clientLabel.length>100)throw new ConvexError("INVALID_FIELDS");
    const creationPayload=JSON.stringify({practitionerId:args.practitionerId,startsAt:args.startsAt,endsAt:args.endsAt,clientLabel:args.clientLabel});
    const previous=await ctx.db.query("bookings").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",args.requestKey)).unique();
    if(previous){if(previous.clientId||original(previous)!==creationPayload||previous.createdBy!==user.tokenIdentifier)throw new ConvexError("IDEMPOTENCY_MISMATCH");return previous._id;}
    const tenant=await ctx.db.get(args.tenantId);if(!tenant)throw new ConvexError("FORBIDDEN");requireBookingHours(tenant,args.startsAt,args.endsAt);
    await free(ctx,args.tenantId,args.startsAt,args.endsAt);
    const id=await ctx.db.insert("bookings",{...args,creationPayload,status:"scheduled",revision:0,createdBy:user.tokenIdentifier});
    await event(ctx,(await ctx.db.get(id))!,user.tokenIdentifier,"created",0);return id;
  },
});
export const createLinked=mutation({
  args:{tenantId:v.id("tenants"),clientId:v.id("clients"),serviceId:v.id("services"),startsAt:v.number(),requestKey:v.string()},
  handler:async(ctx,args)=>{
    return createLinkedBooking(ctx,args);
  },
});
export const reschedule=mutation({
  args:{tenantId:v.id("tenants"),bookingId:v.id("bookings"),startsAt:v.number(),expectedRevision:v.number()},
  handler:async(ctx,args)=>{
    const user=await requireMember(ctx,args.tenantId,true);expectedRevision(args.expectedRevision);
    const record=await ctx.db.get(args.bookingId);if(!record||record.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");
    if(!record.serviceSnapshot)throw new ConvexError("LEGACY_BOOKING");
    if(record.status==="cancelled")throw new ConvexError("BOOKING_CANCELLED");
    const endsAt=args.startsAt+record.serviceSnapshot.durationMinutes*60000;interval(args.startsAt,endsAt);
    if(record.startsAt===args.startsAt)return record._id;
    if((record.revision??0)!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");
    const tenant=await ctx.db.get(args.tenantId);if(!tenant)throw new ConvexError("FORBIDDEN");requireBookingHours(tenant,args.startsAt,endsAt);
    await free(ctx,args.tenantId,args.startsAt,endsAt,record._id);
    const revision=(record.revision??0)+1;await ctx.db.patch(record._id,{startsAt:args.startsAt,endsAt,revision});
    await event(ctx,record,user.tokenIdentifier,"rescheduled",revision,args.startsAt,endsAt);return record._id;
  },
});
export const cancel=mutation({
  args:{tenantId:v.id("tenants"),bookingId:v.id("bookings"),expectedRevision:v.number()},
  handler:async(ctx,args)=>{
    const user=await requireMember(ctx,args.tenantId,true);expectedRevision(args.expectedRevision);
    const record=await ctx.db.get(args.bookingId);if(!record||record.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");
    if(record.status==="cancelled")return record._id;
    if((record.revision??0)!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");
    const revision=(record.revision??0)+1;await ctx.db.patch(record._id,{status:"cancelled",revision});await event(ctx,record,user.tokenIdentifier,"cancelled",revision);return record._id;
  },
});
export const list=query({
  args:{tenantId:v.id("tenants"),practitionerId:v.optional(v.string()),from:v.number(),to:v.number()},
  handler:async(ctx,args)=>{
    await requireMember(ctx,args.tenantId,true);
    if(!Number.isSafeInteger(args.from)||!Number.isSafeInteger(args.to)||args.to<=args.from||args.to-args.from>31*MAX_DURATION)throw new ConvexError("INVALID_WINDOW");
    const rows=await ctx.db.query("bookings").withIndex("by_tenant_start",q=>q.eq("tenantId",args.tenantId).gt("startsAt",args.from-MAX_DURATION).lt("startsAt",args.to)).filter(q=>q.and(q.gt(q.field("endsAt"),args.from),args.practitionerId?q.eq(q.field("practitionerId"),args.practitionerId):q.eq(1,1))).take(201);
    return {items:rows.slice(0,200).map(r=>({_id:r._id,startsAt:r.startsAt,endsAt:r.endsAt,clientLabel:r.clientLabel,...(r.clientId?{clientId:r.clientId}:{}),...(r.serviceId?{serviceId:r.serviceId}:{}),...(r.serviceSnapshot?{serviceSnapshot:r.serviceSnapshot}:{}),...(r.timeZone?{timeZone:r.timeZone}:{}),status:r.status??"scheduled",revision:r.revision??0,legacy:!r.serviceSnapshot})),hasMore:rows.length>200,limit:200};
  },
});

export const today=query({
  args:{tenantId:v.id("tenants"),refreshKey:v.number()},
  handler:async(ctx,{tenantId})=>{
    await requireMember(ctx,tenantId,true);
    const tenant=await ctx.db.get(tenantId);
    if(!tenant)throw new ConvexError("FORBIDDEN");
    if(!tenant.timeZone)return {status:"setup_required" as const};
    const day=practiceDayAt(tenant.timeZone);
    if(!day)return {status:"invalid_time_zone" as const};
    const rows=await ctx.db.query("bookings").withIndex("by_tenant_start",q=>q.eq("tenantId",tenantId).gt("startsAt",day.from-MAX_DURATION).lt("startsAt",day.to)).filter(q=>q.and(q.gt(q.field("endsAt"),day.from),q.neq(q.field("status"),"cancelled"))).take(201);
    return {status:"ready" as const,day:day.day,timeZone:day.timeZone,from:day.from,to:day.to,refreshAfterMs:day.refreshAfterMs,items:rows.slice(0,200).map(r=>({_id:r._id,startsAt:r.startsAt,endsAt:r.endsAt,clientLabel:r.clientLabel,...(r.clientId?{clientId:r.clientId}:{}),...(r.serviceId?{serviceId:r.serviceId}:{}),...(r.serviceSnapshot?{serviceSnapshot:r.serviceSnapshot}:{}),...(r.timeZone?{timeZone:r.timeZone}:{}),status:r.status??"scheduled",revision:r.revision??0,legacy:!r.serviceSnapshot})),hasMore:rows.length>200,limit:200};
  },
});
export const history=query({
  args:{tenantId:v.id("tenants"),bookingId:v.id("bookings")},
  handler:async(ctx,{tenantId,bookingId})=>{
    await requireMember(ctx,tenantId,true);const record=await ctx.db.get(bookingId);if(!record||record.tenantId!==tenantId)throw new ConvexError("FORBIDDEN");
    const rows=await ctx.db.query("bookingEvents").withIndex("by_booking",q=>q.eq("bookingId",bookingId)).order("desc").take(201);
    return {items:rows.slice(0,200).map(({action,at,revision,startsAt,endsAt,previousStartsAt,previousEndsAt})=>({action,at,revision,startsAt,endsAt,...(previousStartsAt!==undefined?{previousStartsAt,previousEndsAt}:{})})),hasMore:rows.length>200,limit:200};
  },
});
