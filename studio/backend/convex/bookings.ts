import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
const MAX_DURATION = 24 * 60 * 60 * 1000;
const fields = {
  tenantId: v.id("tenants"),
  practitionerId: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
  clientLabel: v.string(),
  requestKey: v.string(),
};
export const create = mutation({
  args: fields,
  handler: async (ctx, args) => {
    const user = await requireMember(ctx, args.tenantId, true);
    if (
      !Number.isSafeInteger(args.startsAt) ||
      !Number.isSafeInteger(args.endsAt) ||
      args.startsAt < 0 ||
      args.endsAt <= args.startsAt ||
      args.endsAt - args.startsAt > MAX_DURATION
    )
      throw new ConvexError("INVALID_INTERVAL");
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(args.practitionerId) ||
      !args.requestKey.trim() ||
      args.requestKey.length > 128 ||
      !args.clientLabel.trim() ||
      args.clientLabel.length > 100
    )
      throw new ConvexError("INVALID_FIELDS");
    const previous = await ctx.db
      .query("bookings")
      .withIndex("by_tenant_request", (q) =>
        q.eq("tenantId", args.tenantId).eq("requestKey", args.requestKey),
      )
      .unique();
    if (previous) {
      if (
        previous.practitionerId !== args.practitionerId ||
        previous.startsAt !== args.startsAt ||
        previous.endsAt !== args.endsAt ||
        previous.clientLabel !== args.clientLabel
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return previous._id;
    }
    // Every interval is <=24h, so no possible overlap starts earlier than this
    // lower bound. The indexed range participates in the mutation's read set.
    const overlap = await ctx.db
      .query("bookings")
      .withIndex("by_tenant_practitioner_start", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("practitionerId", args.practitionerId)
          .gt("startsAt", args.startsAt - MAX_DURATION)
          .lt("startsAt", args.endsAt),
      )
      .filter((q) => q.gt(q.field("endsAt"), args.startsAt))
      .first();
    if (overlap) throw new ConvexError("BOOKING_CONFLICT");
    return ctx.db.insert("bookings", {
      ...args,
      createdBy: user.tokenIdentifier,
    });
  },
});
export const list = query({
  args: {
    tenantId: v.id("tenants"),
    practitionerId: v.string(),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId);
    if (
      !Number.isSafeInteger(args.from) ||
      !Number.isSafeInteger(args.to) ||
      args.to <= args.from ||
      args.to - args.from > 31 * MAX_DURATION
    )
      throw new ConvexError("INVALID_WINDOW");
    const items = await ctx.db
      .query("bookings")
      .withIndex("by_tenant_practitioner_start", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("practitionerId", args.practitionerId)
          .gte("startsAt", args.from)
          .lt("startsAt", args.to),
      )
      .take(201);
    return {
      items: items.slice(0, 200),
      hasMore: items.length > 200,
      limit: 200,
    };
  },
});
