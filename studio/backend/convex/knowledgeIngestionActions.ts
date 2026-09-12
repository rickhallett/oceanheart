"use node";
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { action } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { extractDocument, IngestionError } from "./lib/documentExtraction";

const claim = makeFunctionReference<"mutation", {tenantId:Id<"tenants">;uploadId:Id<"knowledgeUploads">;actor:string}, Doc<"knowledgeUploads">>("knowledgeIngestion:claim");
const complete = makeFunctionReference<"mutation", {uploadId:Id<"knowledgeUploads">;actor:string;content:string;hash:string}, Id<"knowledgeSources">>("knowledgeIngestion:complete");
const fail = makeFunctionReference<"mutation", {uploadId:Id<"knowledgeUploads">;actor:string;errorCode:"FILE_TOO_LARGE"|"INVALID_TEXT"|"UNREADABLE_SCAN"|"EXTRACTION_FAILED"}, null>("knowledgeIngestion:fail");
const authorised = makeFunctionReference<"query", {tenantId:Id<"tenants">;identity:string}, boolean>("knowledgeIngestion:authorised");
const registerOwned = makeFunctionReference<"mutation", {tenantId:Id<"tenants">;actor:string;storageId:Id<"_storage">;title:string;provenance:string;format:"text"|"markdown"|"pdf"|"docx";requestKey:string;targetSourceId?:Id<"knowledgeSources">;expectedRevision?:number}, {uploadId:Id<"knowledgeUploads">;reused:boolean}>("knowledgeIngestion:registerOwned");

export const process = action({
  args:{tenantId:v.id("tenants"),uploadId:v.id("knowledgeUploads")},
  handler:async(ctx,args)=>{const identity=await ctx.auth.getUserIdentity();if(!identity)throw new ConvexError("UNAUTHENTICATED");const row=await ctx.runMutation(claim,{tenantId:args.tenantId,uploadId:args.uploadId,actor:identity.tokenIdentifier});if(row.status==="ready")return row.sourceId;let content:string;try{const blob=await ctx.storage.get(row.storageId);if(!blob)throw new IngestionError("INVALID_TEXT");content=await extractDocument(new Uint8Array(await blob.arrayBuffer()),row.format);}catch(error){const code=error instanceof IngestionError?error.code:"EXTRACTION_FAILED";await ctx.runMutation(fail,{uploadId:row._id,actor:identity.tokenIdentifier,errorCode:code});throw new ConvexError(code);}const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(content)))).map(x=>x.toString(16).padStart(2,"0")).join("");return ctx.runMutation(complete,{uploadId:row._id,actor:identity.tokenIdentifier,content,hash});},
});

export const upload = action({
  args:{tenantId:v.id("tenants"),bytes:v.bytes(),title:v.string(),provenance:v.string(),format:v.union(v.literal("text"),v.literal("markdown"),v.literal("pdf"),v.literal("docx")),requestKey:v.string(),targetSourceId:v.optional(v.id("knowledgeSources")),expectedRevision:v.optional(v.number())},
  handler:async(ctx,args)=>{const identity=await ctx.auth.getUserIdentity();if(!identity)throw new ConvexError("UNAUTHENTICATED");const allowed=await ctx.runQuery(authorised,{tenantId:args.tenantId,identity:identity.tokenIdentifier});if(!allowed)throw new ConvexError("FORBIDDEN");if(args.bytes.byteLength>5*1024*1024)throw new ConvexError("FILE_TOO_LARGE");const storageId=await ctx.storage.store(new Blob([args.bytes],{type:"application/octet-stream"}));try{const result=await ctx.runMutation(registerOwned,{tenantId:args.tenantId,actor:identity.tokenIdentifier,storageId,title:args.title,provenance:args.provenance,format:args.format,requestKey:args.requestKey,targetSourceId:args.targetSourceId,expectedRevision:args.expectedRevision});if(result.reused)await ctx.storage.delete(storageId);return {uploadId:result.uploadId};}catch(error){await ctx.storage.delete(storageId);throw error;}},
});
