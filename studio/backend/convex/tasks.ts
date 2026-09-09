import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";

const taskFilter = v.union(
  v.literal("all"),
  v.literal("open"),
  v.literal("completed"),
);

function taskTitle(value: string) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 200 ||
    /[\r\n\x00-\x1f\x7f]/.test(normalized)
  )
    throw new ConvexError("INVALID_TITLE");
  return normalized;
}

function expectedRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ConvexError("INVALID_REVISION");
}

export const list = query({
  // `filter` is optional so deployed clients using the original list contract
  // keep receiving the complete, active task list.
  args: { tenantId: v.id("tenants"), filter: v.optional(taskFilter) },
  handler: async (ctx, { tenantId, filter = "all" }) => {
    await requireMember(ctx, tenantId);
    const source =
      filter === "all"
        ? ctx.db
            .query("tasks")
            .withIndex("by_tenant_removed", (q) =>
              q.eq("tenantId", tenantId).eq("removedAt", undefined),
            )
        : ctx.db
            .query("tasks")
            .withIndex("by_tenant_removed_completed", (q) =>
              q
                .eq("tenantId", tenantId)
                .eq("removedAt", undefined)
                .eq("completed", filter === "completed"),
            );
    const rows = await source.order("desc").take(201);
    return {
      items: rows
        .slice(0, 200)
        .map(({ _id, title, completed, createdAt, revision }) => ({
          _id,
          title,
          completed,
          createdAt,
          revision: revision ?? 0,
        })),
      hasMore: rows.length > 200,
      limit: 200,
    };
  },
});

export const create = mutation({
  args: { tenantId: v.id("tenants"), title: v.string(), requestKey: v.string() },
  handler: async (ctx, { tenantId, title: rawTitle, requestKey }) => {
    const user = await requireMember(ctx, tenantId, true);
    const normalizedTitle = taskTitle(rawTitle);
    if (!requestKey || requestKey.trim() !== requestKey || requestKey.length > 128)
      throw new ConvexError("INVALID_REQUEST_KEY");
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_tenant_request", (q) =>
        q.eq("tenantId", tenantId).eq("requestKey", requestKey),
      )
      .unique();
    if (existing) {
      // The create receipt is deliberately independent from later edits or
      // removal, so a lost original response cannot create a second task.
      if (
        (existing.creationTitle ?? existing.title) !== normalizedTitle ||
        existing.createdBy !== user.tokenIdentifier
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return existing._id;
    }
    return ctx.db.insert("tasks", {
      tenantId,
      title: normalizedTitle,
      creationTitle: normalizedTitle,
      completed: false,
      revision: 0,
      createdAt: Date.now(),
      createdBy: user.tokenIdentifier,
      requestKey,
    });
  },
});

export const setCompleted = mutation({
  args: {
    tenantId: v.id("tenants"),
    taskId: v.id("tasks"),
    completed: v.boolean(),
    // Existing clients did not send this. They remain valid, but use the
    // former last-write-wins rule; the write still advances revision.
    expectedRevision: v.optional(v.number()),
  },
  handler: async (ctx, { tenantId, taskId, completed, expectedRevision: expected }) => {
    await requireMember(ctx, tenantId, true);
    if (expected !== undefined) expectedRevision(expected);
    const task = await ctx.db.get(taskId);
    if (!task || task.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    if (task.removedAt !== undefined) throw new ConvexError("TASK_REMOVED");
    if (task.completed === completed) return taskId;
    if (expected !== undefined && (task.revision ?? 0) !== expected)
      throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(taskId, {
      completed,
      revision: (task.revision ?? 0) + 1,
    });
    return taskId;
  },
});

export const update = mutation({
  args: {
    tenantId: v.id("tenants"),
    taskId: v.id("tasks"),
    title: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, { tenantId, taskId, title: rawTitle, expectedRevision: expected }) => {
    await requireMember(ctx, tenantId, true);
    expectedRevision(expected);
    const task = await ctx.db.get(taskId);
    if (!task || task.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    if (task.removedAt !== undefined) throw new ConvexError("TASK_REMOVED");
    const normalizedTitle = taskTitle(rawTitle);
    if (task.title === normalizedTitle)
      return { taskId, revision: task.revision ?? 0 };
    if ((task.revision ?? 0) !== expected)
      throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(taskId, {
      title: normalizedTitle,
      creationTitle: task.creationTitle ?? task.title,
      revision: (task.revision ?? 0) + 1,
    });
    return { taskId, revision: (task.revision ?? 0) + 1 };
  },
});

export const remove = mutation({
  args: {
    tenantId: v.id("tenants"),
    taskId: v.id("tasks"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, { tenantId, taskId, expectedRevision: expected }) => {
    await requireMember(ctx, tenantId, true);
    expectedRevision(expected);
    const task = await ctx.db.get(taskId);
    if (!task || task.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    if (task.removedAt !== undefined) return taskId;
    if ((task.revision ?? 0) !== expected)
      throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(taskId, {
      removedAt: Date.now(),
      creationTitle: task.creationTitle ?? task.title,
      revision: (task.revision ?? 0) + 1,
    });
    return taskId;
  },
});
