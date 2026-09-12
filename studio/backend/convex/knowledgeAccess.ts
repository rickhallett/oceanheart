import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/access";
import { requireKnowledgeAccess } from "./lib/knowledgeAccess";

function identity(value: string) {
  if (!value || value.trim() !== value || value.length > 500)
    throw new ConvexError("INVALID_IDENTITY");
  return value;
}

export const status = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new ConvexError("UNAUTHENTICATED");
    const membership = await ctx.db.query("memberships").withIndex("by_tenant_identity", q => q.eq("tenantId", tenantId).eq("identity", user.tokenIdentifier)).unique();
    if (membership?.role === "owner") return { capability: "owner" as const };
    const grant = await ctx.db.query("knowledgeAccessGrants").withIndex("by_tenant_identity", q => q.eq("tenantId", tenantId).eq("identity", user.tokenIdentifier)).unique();
    return { capability: grant?.active ? grant.capability : null };
  },
});

export const grant = mutation({
  args: {
    tenantId: v.id("tenants"),
    identity: v.string(),
    capability: v.union(v.literal("read"), v.literal("contribute")),
  },
  handler: async (ctx, args) => {
    const owner = await requireMember(ctx, args.tenantId, true);
    const subject = identity(args.identity);
    const prior = await ctx.db.query("knowledgeAccessGrants")
      .withIndex("by_tenant_identity", q => q.eq("tenantId", args.tenantId).eq("identity", subject)).unique();
    if (prior) {
      await ctx.db.patch(prior._id, { capability: args.capability, active: true, revokedAt: undefined });
      return prior._id;
    }
    return ctx.db.insert("knowledgeAccessGrants", { tenantId: args.tenantId, identity: subject, capability: args.capability, active: true, createdBy: owner.tokenIdentifier, createdAt: Date.now() });
  },
});

export const revoke = mutation({
  args: { tenantId: v.id("tenants"), identity: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    const row = await ctx.db.query("knowledgeAccessGrants")
      .withIndex("by_tenant_identity", q => q.eq("tenantId", args.tenantId).eq("identity", identity(args.identity))).unique();
    if (!row) return null;
    await ctx.db.patch(row._id, { active: false, revokedAt: Date.now() });
    return row._id;
  },
});
