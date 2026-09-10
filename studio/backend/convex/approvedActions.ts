import { v, ConvexError } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./lib/access";
import { requestKey as checkKey } from "./lib/catalog";
import {
  proposalTask,
  proposalReference,
  proposalEvidence,
  PROPOSAL_LIFETIME_MS,
} from "./lib/actionContract";
import { createTask, setTaskCompleted, taskTitle, taskDueDate } from "./tasks";
import { resolveCurrent } from "./citedAnswers";
const identify = {
  tenantId: v.id("tenants"),
  proposalId: v.id("actionProposals"),
};
async function owned(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  proposalId: Id<"actionProposals">,
) {
  const actor = await requireMember(ctx, tenantId, true),
    proposal = await ctx.db.get(proposalId);
  if (
    !proposal ||
    proposal.tenantId !== tenantId ||
    proposal.actor !== actor.tokenIdentifier
  )
    throw new ConvexError("FORBIDDEN");
  return proposal;
}
async function evidence(
  ctx: QueryCtx,
  p: Pick<Doc<"actionProposals">, "tenantId" | "references" | "citations">,
) {
  if (!p.citations.length || p.citations.length > 4)
    throw new ConvexError("INVALID_CITATION");
  await resolveCurrent(ctx, p);
  return Promise.all(
    p.references.map(async (r) => (await ctx.db.get(r.sourceId))!.revision),
  );
}
async function current(ctx: QueryCtx, p: Doc<"actionProposals">) {
  if (!["task.create", "task.complete"].includes(p.action) || p.version !== 1)
    throw new ConvexError("INVALID_ACTION");
  if (Date.now() >= p.expiresAt) throw new ConvexError("PROPOSAL_EXPIRED");
  if (p.action === "task.complete") {
    if (!p.target) throw new ConvexError("INVALID_ACTION");
    const task = await ctx.db.get(p.target.taskId);
    if (!task || task.tenantId !== p.tenantId)
      throw new ConvexError("FORBIDDEN");
    if (
      task.removedAt !== undefined ||
      task.completed ||
      (task.revision ?? 0) !== p.target.revision ||
      task.title !== p.task.title ||
      task.dueDate !== p.task.dueDate
    )
      throw new ConvexError("TASK_CHANGED");
    return;
  }
  const revisions = await evidence(ctx, p);
  if (
    revisions.some((r, i) => r !== p.sourceRevisions[i]) ||
    revisions.length !== p.sourceRevisions.length
  )
    throw new ConvexError("SOURCE_UNAVAILABLE");
}
export const prepare = mutation({
  args: {
    tenantId: v.id("tenants"),
    task: proposalTask,
    references: v.array(proposalReference),
    citations: v.array(proposalEvidence),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx, args.tenantId, true);
    checkKey(args.requestKey);
    const task = {
      title: taskTitle(args.task.title),
      ...(args.task.dueDate ? { dueDate: taskDueDate(args.task.dueDate) } : {}),
    };
    const payload = JSON.stringify({
      task,
      references: args.references,
      citations: args.citations,
    });
    const prior = await ctx.db
      .query("actionProposals")
      .withIndex("by_tenant_request", (q) =>
        q.eq("tenantId", args.tenantId).eq("requestKey", args.requestKey),
      )
      .unique();
    if (prior) {
      if (
        prior.actor !== actor.tokenIdentifier ||
        prior.creationPayload !== payload
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return prior._id;
    }
    const sourceRevisions = await evidence(ctx, args),
      now = Date.now();
    return ctx.db.insert("actionProposals", {
      tenantId: args.tenantId,
      actor: actor.tokenIdentifier,
      action: "task.create",
      version: 1,
      task,
      references: args.references,
      citations: args.citations,
      sourceRevisions,
      requestKey: args.requestKey,
      creationPayload: payload,
      status: "pending",
      createdAt: now,
      expiresAt: now + PROPOSAL_LIFETIME_MS,
    });
  },
});
export const prepareCompletion = mutation({
  args: {
    tenantId: v.id("tenants"),
    taskId: v.id("tasks"),
    expectedRevision: v.number(),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx, args.tenantId, true);
    checkKey(args.requestKey);
    if (
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    )
      throw new ConvexError("INVALID_REVISION");
    const payload = JSON.stringify({
      action: "task.complete",
      taskId: args.taskId,
      revision: args.expectedRevision,
    });
    const prior = await ctx.db
      .query("actionProposals")
      .withIndex("by_tenant_request", (q) =>
        q.eq("tenantId", args.tenantId).eq("requestKey", args.requestKey),
      )
      .unique();
    if (prior) {
      if (
        prior.actor !== actor.tokenIdentifier ||
        prior.creationPayload !== payload
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return prior._id;
    }
    const task = await ctx.db.get(args.taskId);
    if (!task || task.tenantId !== args.tenantId)
      throw new ConvexError("FORBIDDEN");
    if (
      task.removedAt !== undefined ||
      task.completed ||
      (task.revision ?? 0) !== args.expectedRevision
    )
      throw new ConvexError("TASK_CHANGED");
    const now = Date.now();
    return ctx.db.insert("actionProposals", {
      tenantId: args.tenantId,
      actor: actor.tokenIdentifier,
      action: "task.complete",
      version: 1,
      task: {
        title: task.title,
        ...(task.dueDate !== undefined ? { dueDate: task.dueDate } : {}),
      },
      target: { taskId: task._id, revision: args.expectedRevision },
      references: [],
      citations: [],
      sourceRevisions: [],
      requestKey: args.requestKey,
      creationPayload: payload,
      status: "pending",
      createdAt: now,
      expiresAt: now + PROPOSAL_LIFETIME_MS,
    });
  },
});
export const get = query({
  args: identify,
  handler: async (ctx, args) => {
    const p = await owned(ctx, args.tenantId, args.proposalId);
    let eligible = p.status === "pending",
      reason = "";
    if (eligible)
      try {
        await current(ctx, p);
      } catch {
        eligible = false;
        reason =
          p.action === "task.complete"
            ? "The task changed or this proposal expired. Prepare a new proposal."
            : "The proposal expired or its source approval changed. Prepare a new proposal.";
      }
    return {
      proposalId: p._id,
      action: p.action,
      version: p.version,
      task: p.task,
      target: p.target ?? null,
      status: p.status,
      expiresAt: p.expiresAt,
      taskId: p.taskId ?? null,
      eligible,
      reason,
    };
  },
});
export const approve = mutation({
  args: identify,
  handler: async (ctx, args) => {
    const p = await owned(ctx, args.tenantId, args.proposalId);
    // Original successful receipt precedes mutable expiry/evidence/task-state checks.
    if (p.status === "executed") {
      if (!p.taskId) throw new ConvexError("INVALID_RECEIPT");
      return p.taskId;
    }
    if (p.status !== "pending") throw new ConvexError("PROPOSAL_REJECTED");
    await current(ctx, p);
    const taskId =
      p.action === "task.complete"
        ? await setTaskCompleted(ctx, {
            tenantId: p.tenantId,
            taskId: p.target!.taskId,
            expectedRevision: p.target!.revision,
            completed: true,
          })
        : await createTask(
            ctx,
            {
              tenantId: p.tenantId,
              ...p.task,
              requestKey: `proposal:${p._id}`,
            },
            true,
          );
    await ctx.db.patch(p._id, {
      status: "executed",
      taskId,
      decidedAt: Date.now(),
    });
    return taskId;
  },
});
export const reject = mutation({
  args: identify,
  handler: async (ctx, args) => {
    const p = await owned(ctx, args.tenantId, args.proposalId);
    if (p.status === "executed") throw new ConvexError("ALREADY_EXECUTED");
    if (p.status === "pending")
      await ctx.db.patch(p._id, { status: "rejected", decidedAt: Date.now() });
    return p._id;
  },
});
