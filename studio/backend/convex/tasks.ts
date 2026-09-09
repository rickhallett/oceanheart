import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";

export const list = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    await requireMember(ctx, tenantId);
    const rows = await ctx.db.query("tasks").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).order("desc").take(201);
    return { items: rows.slice(0, 200).map(({ _id, title, completed, createdAt }) => ({ _id, title, completed, createdAt })), hasMore: rows.length > 200, limit: 200 };
  },
});
export const create = mutation({
  args: { tenantId: v.id("tenants"), title: v.string(), requestKey: v.string() },
  handler: async (ctx, { tenantId, title: rawTitle, requestKey }) => {
    const user = await requireMember(ctx, tenantId, true);
    const title = rawTitle.trim();
    if (!title || title.length > 200 || /[\r\n\x00-\x1f\x7f]/.test(title)) throw new ConvexError("INVALID_TITLE");
    if (!requestKey || requestKey.trim() !== requestKey || requestKey.length > 128) throw new ConvexError("INVALID_REQUEST_KEY");
    const existing = await ctx.db.query("tasks").withIndex("by_tenant_request", q => q.eq("tenantId", tenantId).eq("requestKey", requestKey)).unique();
    if (existing) {
      if (existing.title !== title || existing.createdBy !== user.tokenIdentifier) throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return existing._id;
    }
    return ctx.db.insert("tasks", { tenantId, title, completed: false, createdAt: Date.now(), createdBy: user.tokenIdentifier, requestKey });
  },
});
export const setCompleted = mutation({
  args: { tenantId: v.id("tenants"), taskId: v.id("tasks"), completed: v.boolean() },
  handler: async (ctx, { tenantId, taskId, completed }) => {
    await requireMember(ctx, tenantId, true);
    const task = await ctx.db.get(taskId);
    if (!task || task.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    if (task.completed !== completed) await ctx.db.patch(taskId, { completed });
    return taskId;
  },
});
