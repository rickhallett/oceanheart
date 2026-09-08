import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new ConvexError("UNAUTHENTICATED");
    const name = args.name.trim();
    if (!name || name.length > 100) throw new ConvexError("INVALID_NAME");
    const tenantId = await ctx.db.insert("tenants", { name });
    await ctx.db.insert("memberships", {
      tenantId,
      identity: user.tokenIdentifier,
      role: "owner",
    });
    return tenantId;
  },
});
export const addViewer = mutation({
  args: { tenantId: v.id("tenants"), identity: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    if (!args.identity || args.identity.length > 500)
      throw new ConvexError("INVALID_IDENTITY");
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_tenant_identity", (q) =>
        q.eq("tenantId", args.tenantId).eq("identity", args.identity),
      )
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("memberships", {
      tenantId: args.tenantId,
      identity: args.identity,
      role: "viewer",
    });
  },
});
export const removeViewer = mutation({
  args: { tenantId: v.id("tenants"), identity: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_tenant_identity", (q) =>
        q.eq("tenantId", args.tenantId).eq("identity", args.identity),
      )
      .unique();
    if (existing?.role === "viewer") await ctx.db.delete(existing._id);
  },
});
