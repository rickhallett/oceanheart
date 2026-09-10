import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember } from "./lib/access";
export const status = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    await requireMember(ctx, tenantId, true);
    const row = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .unique();
    return {
      connected: row?.status === "connected",
      generation: row?.generation ?? 0,
      ...(row?.mailbox ? { mailbox: row.mailbox } : {}),
      needsReconnect: row?.status === "reauth_required",
    };
  },
});
