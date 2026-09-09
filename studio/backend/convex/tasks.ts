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

// Optional real calendar date as YYYY-MM-DD. A calendar date is not an
// instant: no time zone, no time of day, no Today/client interpretation.
function taskDueDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ConvexError("INVALID_DUE_DATE");
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1)
    throw new ConvexError("INVALID_DUE_DATE");
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > lengths[month - 1]) throw new ConvexError("INVALID_DUE_DATE");
  return value;
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
        .map(({ _id, title, completed, createdAt, revision, dueDate }) => ({
          _id,
          title,
          completed,
          createdAt,
          revision: revision ?? 0,
          ...(dueDate !== undefined ? { dueDate } : {}),
        })),
      hasMore: rows.length > 200,
      limit: 200,
    };
  },
});

export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    title: v.string(),
    requestKey: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, { tenantId, title: rawTitle, requestKey, dueDate: rawDueDate }) => {
    const user = await requireMember(ctx, tenantId, true);
    const normalizedTitle = taskTitle(rawTitle);
    const normalizedDueDate =
      rawDueDate === undefined ? undefined : taskDueDate(rawDueDate);
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
      // The receipt includes the original due date: retrying the original
      // request after a rename, date edit or removal returns the same id,
      // while reusing the key with different details is rejected.
      // Absence is immutable too: a date-less create stores creationTitle
      // with no creationDueDate, so its receipt is "no date" even after a
      // later update adds one. Only legacy rows (no creationTitle marker)
      // fall back to the live fields as their pre-image.
      const originalDueDate =
        existing.creationTitle !== undefined
          ? (existing.creationDueDate ?? undefined)
          : (existing.dueDate ?? undefined);
      if (
        (existing.creationTitle ?? existing.title) !== normalizedTitle ||
        originalDueDate !== normalizedDueDate ||
        existing.createdBy !== user.tokenIdentifier
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return existing._id;
    }
    return ctx.db.insert("tasks", {
      tenantId,
      title: normalizedTitle,
      creationTitle: normalizedTitle,
      ...(normalizedDueDate !== undefined
        ? { dueDate: normalizedDueDate, creationDueDate: normalizedDueDate }
        : {}),
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
    // Legacy callers omit dueDate and keep the existing date. An explicit
    // null clears the date; a YYYY-MM-DD string sets it.
    dueDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (
    ctx,
    { tenantId, taskId, title: rawTitle, expectedRevision: expected, dueDate: rawDueDate },
  ) => {
    await requireMember(ctx, tenantId, true);
    expectedRevision(expected);
    const task = await ctx.db.get(taskId);
    if (!task || task.tenantId !== tenantId) throw new ConvexError("FORBIDDEN");
    if (task.removedAt !== undefined) throw new ConvexError("TASK_REMOVED");
    const normalizedTitle = taskTitle(rawTitle);
    const currentDueDate = task.dueDate ?? undefined;
    const desiredDueDate =
      rawDueDate === undefined
        ? currentDueDate
        : rawDueDate === null
          ? undefined
          : taskDueDate(rawDueDate);
    if (task.title === normalizedTitle && currentDueDate === desiredDueDate)
      return { taskId, revision: task.revision ?? 0 };
    if ((task.revision ?? 0) !== expected)
      throw new ConvexError("REVISION_CONFLICT");
    // Backfill the immutable create receipt for legacy rows only. Using the
    // creationTitle marker avoids overwriting an originally-absent date with
    // a later edited date on the second write.
    const backfill =
      task.creationTitle === undefined
        ? {
            creationTitle: task.title,
            ...(task.dueDate !== undefined
              ? { creationDueDate: task.dueDate }
              : {}),
          }
        : {};
    await ctx.db.patch(taskId, {
      title: normalizedTitle,
      ...(rawDueDate === undefined
        ? {}
        : desiredDueDate === undefined
          ? { dueDate: undefined }
          : { dueDate: desiredDueDate }),
      ...backfill,
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
      ...(task.creationTitle === undefined
        ? {
            creationTitle: task.title,
            ...(task.dueDate !== undefined
              ? { creationDueDate: task.dueDate }
              : {}),
          }
        : {}),
      revision: (task.revision ?? 0) + 1,
    });
    return taskId;
  },
});
