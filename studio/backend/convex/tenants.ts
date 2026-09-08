import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
function validateIdentity(identity: string) {
  // Token identifiers are opaque. Reject empty/padded values rather than
  // silently rewriting an issuer's subject before membership lookup.
  if (!identity || identity.trim() !== identity || identity.length > 500)
    throw new ConvexError("INVALID_IDENTITY");
}
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
    validateIdentity(args.identity);
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
    validateIdentity(args.identity);
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_tenant_identity", (q) =>
        q.eq("tenantId", args.tenantId).eq("identity", args.identity),
      )
      .unique();
    if (existing?.role === "viewer") await ctx.db.delete(existing._id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new ConvexError("UNAUTHENTICATED");
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_identity", (q) => q.eq("identity", user.tokenIdentifier))
      .collect();
    const practices = await Promise.all(
      memberships.map(async (membership) => {
        const tenant = await ctx.db.get(membership.tenantId);
        return tenant
          ? { _id: tenant._id, name: tenant.name, role: membership.role }
          : null;
      }),
    );
    return practices.filter((practice) => practice !== null);
  },
});
