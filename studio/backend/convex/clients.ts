import { createClient } from "./lib/createClient";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import * as validate from "./lib/catalog";
const fields={name:v.string(),email:v.optional(v.string()),phone:v.optional(v.string())};

export const notes = query({
  args: { tenantId: v.id("tenants"), clientId: v.id("clients") },
  handler: async (ctx, { tenantId, clientId }) => {
    await requireMember(ctx, tenantId, true);
    const client = await ctx.db.get(clientId);
    if (!client || client.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    return { text: client.privateNotes ?? "", revision: client.notesRevision ?? 0 };
  },
});

export const saveNotes = mutation({
  args: { tenantId: v.id("tenants"), clientId: v.id("clients"), text: v.string(), expectedRevision: v.number() },
  handler: async (ctx, { tenantId, clientId, text, expectedRevision }) => {
    await requireMember(ctx, tenantId, true);
    const client = await ctx.db.get(clientId);
    if (!client || client.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    validate.expectedRevision(expectedRevision);
    if (text.length > 4000) throw new ConvexError("INVALID_NOTES");
    const revision = client.notesRevision ?? 0;
    // Identical retries are harmless; conflicting stale drafts cannot overwrite.
    if (text === (client.privateNotes ?? "")) return { text, revision };
    if (expectedRevision !== revision) throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(clientId, { privateNotes: text, notesRevision: revision + 1 });
    return { text, revision: revision + 1 };
  },
});
export const create=mutation({
  args:{tenantId:v.id("tenants"),...fields,requestKey:v.string()},
  handler:async(ctx,args)=>{
    return createClient(ctx,args);
  },
});
export const update=mutation({
  args:{tenantId:v.id("tenants"),clientId:v.id("clients"),...fields,expectedRevision:v.number()},
  handler:async(ctx,args)=>{
    await requireMember(ctx,args.tenantId,true);validate.expectedRevision(args.expectedRevision);
    const data=validate.clientFields(args),record=await ctx.db.get(args.clientId);
    if(!record||record.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");
    const oldPayload=JSON.stringify(validate.clientFields(record));
    if(oldPayload===JSON.stringify(data))return record._id;
    if((record.revision??0)!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(record._id,{...data,creationPayload:record.creationPayload??oldPayload,searchText:validate.searchText(data.name,data.email),archived:record.archived??false,revision:(record.revision??0)+1});return record._id;
  },
});
export const setArchived=mutation({
  args:{tenantId:v.id("tenants"),clientId:v.id("clients"),archived:v.boolean(),expectedRevision:v.number()},
  handler:async(ctx,args)=>{
    await requireMember(ctx,args.tenantId,true);validate.expectedRevision(args.expectedRevision);
    const record=await ctx.db.get(args.clientId);if(!record||record.tenantId!==args.tenantId)throw new ConvexError("FORBIDDEN");
    if((record.archived??false)===args.archived)return record._id;
    if((record.revision??0)!==args.expectedRevision)throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(record._id,{archived:args.archived,searchText:validate.searchText(record.name,record.email),revision:(record.revision??0)+1});return record._id;
  },
});
export const list=query({
  args:{tenantId:v.id("tenants"),archived:v.optional(v.boolean()),search:v.optional(v.string()),paginationOpts:paginationOptsValidator},
  handler:async(ctx,{tenantId,archived=false,search,paginationOpts})=>{
    await requireMember(ctx,tenantId,true);validate.pageSize(paginationOpts.numItems);
    const term=search?.trim()??"";
    if(term.length>100||term.split(/\s+/).length>16)throw new ConvexError("INVALID_SEARCH");
    const result=term?await ctx.db.query("clients").withSearchIndex("search_clients",q=>q.search("searchText",term).eq("tenantId",tenantId).eq("archived",archived)).paginate(paginationOpts):await ctx.db.query("clients").withIndex("by_tenant_archived",q=>q.eq("tenantId",tenantId).eq("archived",archived)).order("desc").paginate(paginationOpts);
    return {...result,page:result.page.map(({_id,name,email,phone,createdAt,revision,archived})=>({_id,name,...(email?{email}:{}),...(phone?{phone}:{}),createdAt,revision:revision??0,archived:archived??false}))};
  },
});
