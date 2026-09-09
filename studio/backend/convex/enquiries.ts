import { mutation,query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id,Doc } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { v,ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import * as validate from "./lib/catalog";
import { createClient } from "./lib/createClient";
import { createLinkedBooking } from "./lib/bookingCommands";
const contact={name:v.string(),email:v.optional(v.string()),phone:v.optional(v.string())};
function text(value:string,max:number,allowEmpty=false){const result=value.trim();if((!allowEmpty&&!result)||result.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result))throw new ConvexError("INVALID_TEXT");return result;}
function subject(value:string){const result=text(value,150);if(/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value))throw new ConvexError("INVALID_SUBJECT");return result;}
async function owned(ctx:MutationCtx|QueryCtx,tenantId:Id<"tenants">,enquiryId:Id<"enquiries">){const user=await requireMember(ctx,tenantId,true);const row=await ctx.db.get(enquiryId);if(!row||row.tenantId!==tenantId)throw new ConvexError("FORBIDDEN");return {user,row};}
function summary(row:Doc<"enquiries">){return {_id:row._id,name:row.name,subject:row.subject,resolved:row.resolved,hasDraft:!!row.draft,revision:row.revision,createdAt:row.createdAt,...(row.clientId?{clientId:row.clientId}:{}),...(row.bookingId?{bookingId:row.bookingId}:{})};}
async function event(ctx:MutationCtx,row:Doc<"enquiries">,actor:string,action:"captured"|"draft_saved"|"converted"|"resolved"|"reopened",revision:number,extra:{draft?:string;clientId?:Id<"clients">;bookingId?:Id<"bookings">}={}){await ctx.db.insert("enquiryEvents",{tenantId:row.tenantId,enquiryId:row._id,actor,action,at:Date.now(),revision,...extra});}
export const create=mutation({
  args:{tenantId:v.id("tenants"),...contact,subject:v.string(),message:v.string(),requestKey:v.string()},
  handler:async(ctx,args)=>{const user=await requireMember(ctx,args.tenantId,true),fields={...validate.clientFields(args),subject:subject(args.subject),message:text(args.message,5000)},key=validate.requestKey(args.requestKey),creationPayload=JSON.stringify(fields);
    const prior=await ctx.db.query("enquiries").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",key)).unique();if(prior){if(prior.creationPayload!==creationPayload||prior.createdBy!==user.tokenIdentifier)throw new ConvexError("IDEMPOTENCY_MISMATCH");return prior._id;}
    const id=await ctx.db.insert("enquiries",{tenantId:args.tenantId,...fields,draft:"",resolved:false,revision:0,createdAt:Date.now(),createdBy:user.tokenIdentifier,requestKey:key,creationPayload});await event(ctx,(await ctx.db.get(id))!,user.tokenIdentifier,"captured",0);return id;},
});
export const list=query({args:{tenantId:v.id("tenants"),resolved:v.optional(v.boolean()),paginationOpts:paginationOptsValidator},handler:async(ctx,{tenantId,resolved=false,paginationOpts})=>{await requireMember(ctx,tenantId,true);validate.pageSize(paginationOpts.numItems);const result=await ctx.db.query("enquiries").withIndex("by_tenant_resolved",q=>q.eq("tenantId",tenantId).eq("resolved",resolved)).order("desc").paginate(paginationOpts);return {...result,page:result.page.map(summary)};}});
export const get=query({args:{tenantId:v.id("tenants"),enquiryId:v.id("enquiries")},handler:async(ctx,{tenantId,enquiryId})=>{const {row}=await owned(ctx,tenantId,enquiryId);
    const source=await ctx.db.query("gmailImports").withIndex("by_enquiry",q=>q.eq("enquiryId",enquiryId)).unique();
    if(source&&source.tenantId!==tenantId)throw new ConvexError("LINK_CONFLICT");
    const client=row.clientId?await ctx.db.get(row.clientId):null,booking=row.bookingId?await ctx.db.get(row.bookingId):null;
    if((row.clientId&&(!client||client.tenantId!==tenantId))||(row.bookingId&&(!booking||booking.tenantId!==tenantId||booking.clientId!==row.clientId)))throw new ConvexError("LINK_CONFLICT");
    return {...summary(row),...(source?{source:{kind:"gmail" as const,mailbox:source.mailbox,messageId:source.messageId,truncated:source.truncated}}:{}),...(row.email?{email:row.email}:{}),...(row.phone?{phone:row.phone}:{}),message:row.message,draft:row.draft,
      ...(client?{linkedClient:{_id:client._id,name:client.name,archived:client.archived??false}}:{}),
      ...(booking?{linkedBooking:{_id:booking._id,startsAt:booking.startsAt,endsAt:booking.endsAt,status:booking.status??"scheduled",...(booking.timeZone?{timeZone:booking.timeZone}:{}),...(booking.serviceSnapshot?{serviceName:booking.serviceSnapshot.name}:{})}}:{})};}});
export const saveDraft=mutation({args:{tenantId:v.id("tenants"),enquiryId:v.id("enquiries"),text:v.string(),expectedRevision:v.number()},handler:async(ctx,args)=>{const {user,row}=await owned(ctx,args.tenantId,args.enquiryId);validate.expectedRevision(args.expectedRevision);const draft=text(args.text,5000,true);if(row.draft===draft)return row._id;if(row.revision!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");const revision=row.revision+1;await ctx.db.patch(row._id,{draft,revision});await event(ctx,row,user.tokenIdentifier,"draft_saved",revision,{draft});return row._id;}});
export const setResolved=mutation({args:{tenantId:v.id("tenants"),enquiryId:v.id("enquiries"),resolved:v.boolean(),expectedRevision:v.number()},handler:async(ctx,args)=>{const {user,row}=await owned(ctx,args.tenantId,args.enquiryId);validate.expectedRevision(args.expectedRevision);if(row.resolved===args.resolved)return row._id;if(row.revision!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");const revision=row.revision+1;await ctx.db.patch(row._id,{resolved:args.resolved,revision});await event(ctx,row,user.tokenIdentifier,args.resolved?"resolved":"reopened",revision);return row._id;}});
export const history=query({args:{tenantId:v.id("tenants"),enquiryId:v.id("enquiries"),paginationOpts:paginationOptsValidator},handler:async(ctx,{tenantId,enquiryId,paginationOpts})=>{await owned(ctx,tenantId,enquiryId);validate.pageSize(paginationOpts.numItems);const result=await ctx.db.query("enquiryEvents").withIndex("by_enquiry",q=>q.eq("enquiryId",enquiryId)).order("desc").paginate(paginationOpts);return {...result,page:result.page.map(({action,at,revision,draft,clientId,bookingId})=>({action,at,revision,...(draft!==undefined?{draft}:{}),...(clientId?{clientId}:{}),...(bookingId?{bookingId}:{})}))};}});
export const convert=mutation({
  args:{tenantId:v.id("tenants"),enquiryId:v.id("enquiries"),expectedRevision:v.number(),requestKey:v.string(),client:v.union(v.object({existingId:v.id("clients")}),v.object({create:v.object(contact)})),booking:v.optional(v.union(v.object({existingId:v.id("bookings")}),v.object({create:v.object({serviceId:v.id("services"),startsAt:v.number()})})))},
  handler:async(ctx,args)=>{
    const {user,row}=await owned(ctx,args.tenantId,args.enquiryId);validate.expectedRevision(args.expectedRevision);const key=validate.requestKey(args.requestKey);
    const clientChoice="create"in args.client?{create:validate.clientFields(args.client.create)}:{existingId:args.client.existingId};
    const bookingChoice=args.booking?("create"in args.booking?{create:{serviceId:args.booking.create.serviceId,startsAt:args.booking.create.startsAt}}:{existingId:args.booking.existingId}):undefined;
    const payload=JSON.stringify({enquiryId:args.enquiryId,client:clientChoice,booking:bookingChoice});
    const receipt=await ctx.db.query("enquiryConversions").withIndex("by_tenant_request",q=>q.eq("tenantId",args.tenantId).eq("requestKey",key)).unique();
    if(receipt){if(receipt.enquiryId!==row._id||receipt.payload!==payload||receipt.actor!==user.tokenIdentifier)throw new ConvexError("IDEMPOTENCY_MISMATCH");return {clientId:receipt.clientId,...(receipt.bookingId?{bookingId:receipt.bookingId}:{})};}
    if(row.revision!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");
    const clientId=clientChoice.create!==undefined?await createClient(ctx,{tenantId:args.tenantId,...clientChoice.create,requestKey:`enquiry:${row._id}:client`}):clientChoice.existingId;
    const client=await ctx.db.get(clientId);if(!client||client.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");if(client.archived)throw new ConvexError("ARCHIVED_RECORD");if(row.clientId&&row.clientId!==clientId)throw new ConvexError("LINK_CONFLICT");
    let bookingId=row.bookingId;
    if(args.booking){const candidate="create"in args.booking?await createLinkedBooking(ctx,{tenantId:args.tenantId,clientId,...args.booking.create,requestKey:`enquiry:${row._id}:booking`}):args.booking.existingId;
      const booking=await ctx.db.get(candidate);if(!booking||booking.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");if(booking.clientId!==clientId)throw new ConvexError("LINK_CONFLICT");if(booking.status==="cancelled")throw new ConvexError("BOOKING_CANCELLED");if(bookingId&&bookingId!==candidate)throw new ConvexError("LINK_CONFLICT");bookingId=candidate;}
    const result={clientId,...(bookingId?{bookingId}:{})};
    if(row.clientId!==clientId||row.bookingId!==bookingId){const revision=row.revision+1;await ctx.db.patch(row._id,{...result,revision});await event(ctx,row,user.tokenIdentifier,"converted",revision,result);}
    await ctx.db.insert("enquiryConversions",{tenantId:args.tenantId,enquiryId:row._id,requestKey:key,payload,actor:user.tokenIdentifier,...result});return result;
  },
});
