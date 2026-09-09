import { internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireMember } from "./lib/access";
const connectionArgs = { tenantId: v.id("tenants") };
export const connection = internalQuery({
  args: connectionArgs,
  handler: async (ctx, { tenantId }) => {
    const user = await requireMember(ctx, tenantId, true);
    const row = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .unique();
    return {
      actor: user.tokenIdentifier,
      subject: user.subject,
      connection: row,
    };
  },
});
export const begin = internalMutation({
  args: {
    ...connectionArgs,
    stateHash: v.string(),
    bindingHash: v.string(),
    sessionHash: v.string(),
    verifierCipher: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx, args.tenantId, true);
    const connection = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();
    if (connection?.status === "connected")
      throw new ConvexError("ALREADY_CONNECTED");
    const id = await ctx.db.insert("gmailOAuthStates", {
      ...args,
      actor: user.tokenIdentifier,
      generation: connection?.generation ?? 0,
      expiresAt: Date.now() + 600000,
      used: false,
      completed: false,
    });
    await ctx.scheduler.runAfter(600000, internal.gmailInternal.expireState, {
      id,
    });
  },
});
export const consume = internalMutation({
  args: {
    stateHash: v.string(),
    bindingHash: v.string(),
    sessionHash: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_state", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!row) throw new ConvexError("INVALID_OAUTH_STATE");
    const user = await requireMember(ctx, row.tenantId, true);
    if (
      row.actor !== user.tokenIdentifier ||
      row.bindingHash !== args.bindingHash ||
      row.sessionHash !== args.sessionHash ||
      row.expiresAt < Date.now() ||
      row.used
    )
      throw new ConvexError("INVALID_OAUTH_STATE");
    await ctx.db.patch(row._id, { used: true, verifierCipher: "" });
    return { tenantId: row.tenantId, verifierCipher: row.verifierCipher };
  },
});
export const finish = internalMutation({
  args: {
    stateHash: v.string(),
    mailbox: v.string(),
    refreshCipher: v.string(),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_state", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!state) throw new ConvexError("INVALID_OAUTH_STATE");
    const user = await requireMember(ctx, state.tenantId, true);
    if (
      state.actor !== user.tokenIdentifier ||
      !state.used ||
      state.completed ||
      state.expiresAt < Date.now()
    )
      throw new ConvexError("INVALID_OAUTH_STATE");
    const current = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", state.tenantId))
      .unique();
    if ((current?.generation ?? 0) !== state.generation)
      throw new ConvexError("CONNECTION_CHANGED");
    const data = {
      tenantId: state.tenantId,
      mailbox: args.mailbox,
      refreshCipher: args.refreshCipher,
      status: "connected" as const,
      generation: state.generation + 1,
    };
    if (current) await ctx.db.patch(current._id, data);
    else await ctx.db.insert("gmailConnections", data);
    await ctx.db.patch(state._id, { completed: true, verifierCipher: "" });
    return { tenantId: state.tenantId, mailbox: args.mailbox };
  },
});
export const assertCurrent = internalQuery({
  args: { ...connectionArgs, generation: v.number() },
  handler: async (ctx, { tenantId, generation }) => {
    await requireMember(ctx, tenantId, true);
    const row = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .unique();
    if (row?.status !== "connected" || row.generation !== generation)
      throw new ConvexError("CONNECTION_CHANGED");
  },
});
export const updateToken = internalMutation({
  args: {
    ...connectionArgs,
    generation: v.number(),
    refreshCipher: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    const row = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();
    if (row?.status !== "connected" || row.generation !== args.generation)
      throw new ConvexError("CONNECTION_CHANGED");
    await ctx.db.patch(row._id, { refreshCipher: args.refreshCipher });
  },
});
export const disconnect = internalMutation({
  args: {
    ...connectionArgs,
    generation: v.optional(v.number()),
    reauth: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    const row = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();
    if (args.generation !== undefined && row?.generation !== args.generation)
      throw new ConvexError("CONNECTION_CHANGED");
    const data = {
      tenantId: args.tenantId,
      status: args.reauth
        ? ("reauth_required" as const)
        : ("disconnected" as const),
      generation: (row?.generation ?? 0) + 1,
      refreshCipher: undefined,
    };
    if (row) await ctx.db.patch(row._id, data);
    else await ctx.db.insert("gmailConnections", data);
  },
});
export const importMessage = internalMutation({
  args: {
    ...connectionArgs,
    generation: v.number(),
    mailbox: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
    truncated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx, args.tenantId, true);
    const connection = await ctx.db
      .query("gmailConnections")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .unique();
    if (
      connection?.status !== "connected" ||
      connection.generation !== args.generation ||
      connection.mailbox !== args.mailbox
    )
      throw new ConvexError("CONNECTION_CHANGED");
    const prior = await ctx.db
      .query("gmailImports")
      .withIndex("by_message", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("mailbox", args.mailbox)
          .eq("messageId", args.messageId),
      )
      .unique();
    if (prior) return { enquiryId: prior.enquiryId, alreadyImported: true };
    if (
      !args.name ||
      args.name.length > 100 ||
      !args.subject ||
      args.subject.length > 150 ||
      !args.message ||
      args.message.length > 5000
    )
      throw new ConvexError("INVALID_MESSAGE");
    const { name, email, subject, message } = args;
    const fields = { name, ...(email ? { email } : {}), subject, message };
    const enquiryId = await ctx.db.insert("enquiries", {
      tenantId: args.tenantId,
      ...fields,
      draft: "",
      resolved: false,
      revision: 0,
      createdAt: Date.now(),
      createdBy: user.tokenIdentifier,
      requestKey: `gmail:${args.mailbox}:${args.messageId}`,
      creationPayload: JSON.stringify(fields),
    });
    await ctx.db.insert("enquiryEvents", {
      tenantId: args.tenantId,
      enquiryId,
      actor: user.tokenIdentifier,
      action: "captured",
      at: Date.now(),
      revision: 0,
    });
    await ctx.db.insert("gmailImports", {
      tenantId: args.tenantId,
      mailbox: args.mailbox,
      messageId: args.messageId,
      threadId: args.threadId,
      enquiryId,
      truncated: args.truncated,
    });
    return { enquiryId, alreadyImported: false };
  },
});

// Scheduled per-state deletion bounds ciphertext/state retention without scanning a table.
export const expireState = internalMutation({
  args: { id: v.id("gmailOAuthStates") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (row && row.expiresAt <= Date.now()) await ctx.db.delete(id);
  },
});
