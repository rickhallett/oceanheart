import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import { requestKey } from "./lib/catalog";

const attemptStatus = v.union(
  v.literal("creating"),
  v.literal("pending"),
  v.literal("failed"),
  v.literal("paid"),
);

async function competingSessions(
  ctx: MutationCtx,
  attempt: Doc<"paymentAttempts">,
) {
  const rows = (
    await Promise.all(
      (["creating", "pending"] as const).map((status) =>
        ctx.db
          .query("paymentAttempts")
          .withIndex("by_tenant_booking_status", (q) =>
            q
              .eq("tenantId", attempt.tenantId)
              .eq("bookingId", attempt.bookingId)
              .eq("status", status),
          )
          .take(10),
      ),
    )
  ).flat();
  return rows
    .filter((row) => row._id !== attempt._id && row.providerSessionId)
    .map((row) => ({
      attemptId: row._id,
      tenantId: row.tenantId,
      bookingId: row.bookingId,
      providerSessionId: row.providerSessionId!,
      providerIdempotencyKey: row.providerIdempotencyKey,
      amountMinor: row.amountMinor,
      currency: row.currency,
    }));
}

export const reserve = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    bookingId: v.id("bookings"),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireMember(ctx, args.tenantId, true);
    requestKey(args.requestKey);
    const receipt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_tenant_request", (q) =>
        q.eq("tenantId", args.tenantId).eq("requestKey", args.requestKey),
      )
      .unique();
    if (receipt) {
      if (
        receipt.bookingId !== args.bookingId ||
        receipt.actor !== user.tokenIdentifier
      )
        throw new ConvexError("IDEMPOTENCY_MISMATCH");
      return receipt;
    }
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.tenantId !== args.tenantId)
      throw new ConvexError("FORBIDDEN");
    const paid = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_tenant_booking_status", (q) =>
        q
          .eq("tenantId", args.tenantId)
          .eq("bookingId", args.bookingId)
          .eq("status", "paid"),
      )
      .order("desc")
      .first();
    if (paid) {
      if (
        paid.bookingRevision !== (booking.revision ?? 0) ||
        (booking.status ?? "scheduled") !== "scheduled"
      )
        throw new ConvexError("PAYMENT_RECONCILIATION_REQUIRED");
      return paid;
    }
    const latest = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_tenant_booking", (q) =>
        q.eq("tenantId", args.tenantId).eq("bookingId", args.bookingId),
      )
      .order("desc")
      .first();
    if (
      latest &&
      (latest.bookingRevision !== (booking.revision ?? 0) ||
        (booking.status ?? "scheduled") !== "scheduled")
    )
      throw new ConvexError("PAYMENT_RECONCILIATION_REQUIRED");
    if (latest && latest.status !== "failed") return latest;
    if ((booking.status ?? "scheduled") !== "scheduled")
      throw new ConvexError("BOOKING_CANCELLED");
    if (!booking.clientId || !booking.serviceId || !booking.serviceSnapshot)
      throw new ConvexError("PAYMENT_LINKED_BOOKING_REQUIRED");
    if (
      booking.serviceSnapshot.currency !== "GBP" ||
      !Number.isSafeInteger(booking.serviceSnapshot.priceMinor) ||
      booking.serviceSnapshot.priceMinor <= 0
    )
      throw new ConvexError("PAYMENT_AMOUNT_REQUIRED");
    const now = Date.now();
    const attemptId = await ctx.db.insert("paymentAttempts", {
      tenantId: args.tenantId,
      bookingId: args.bookingId,
      requestKey: args.requestKey,
      actor: user.tokenIdentifier,
      bookingRevision: booking.revision ?? 0,
      amountMinor: booking.serviceSnapshot.priceMinor,
      currency: booking.serviceSnapshot.currency,
      serviceName: booking.serviceSnapshot.name,
      status: "creating",
      providerIdempotencyKey: `studio-payment:${args.tenantId}:${args.requestKey}`,
      createdAt: now,
      updatedAt: now,
    });
    return (await ctx.db.get(attemptId))!;
  },
});

export const current = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    attemptId: v.id("paymentAttempts"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.tenantId !== args.tenantId)
      throw new ConvexError("FORBIDDEN");
    return attempt;
  },
});

export const guardCheckout = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    attemptId: v.id("paymentAttempts"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.tenantId !== args.tenantId)
      throw new ConvexError("FORBIDDEN");
    const booking = await ctx.db.get(attempt.bookingId);
    if (!booking || booking.tenantId !== args.tenantId)
      throw new ConvexError("FORBIDDEN");
    const paidSibling = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_tenant_booking_status", (q) =>
        q
          .eq("tenantId", attempt.tenantId)
          .eq("bookingId", attempt.bookingId)
          .eq("status", "paid"),
      )
      .first();
    const bookingChanged =
      (booking.status ?? "scheduled") !== "scheduled" ||
      (booking.revision ?? 0) !== attempt.bookingRevision;
    return {
      attempt,
      reconciliationRequired:
        bookingChanged || (!!paidSibling && paidSibling._id !== attempt._id),
      reason: bookingChanged ? "BOOKING_CHANGED" : "SUPERSEDED_PAYMENT",
    };
  },
});

export const attachSession = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    attemptId: v.id("paymentAttempts"),
    providerSessionId: v.string(),
    providerPaymentIntentId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    providerStatus: v.string(),
    status: attemptStatus,
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.tenantId !== args.tenantId)
      throw new ConvexError("FORBIDDEN");
    if (
      attempt.providerSessionId &&
      attempt.providerSessionId !== args.providerSessionId
    )
      throw new ConvexError("PAYMENT_PROVIDER_MISMATCH");
    const paidSibling = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_tenant_booking_status", (q) =>
        q
          .eq("tenantId", attempt.tenantId)
          .eq("bookingId", attempt.bookingId)
          .eq("status", "paid"),
      )
      .first();
    const booking = await ctx.db.get(attempt.bookingId);
    if (!booking || booking.tenantId !== attempt.tenantId)
      throw new ConvexError("FORBIDDEN");
    const bookingChanged =
      (booking.status ?? "scheduled") !== "scheduled" ||
      (booking.revision ?? 0) !== attempt.bookingRevision;
    const assigned = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_provider_session", (q) =>
        q.eq("providerSessionId", args.providerSessionId),
      )
      .unique();
    if (assigned && assigned._id !== attempt._id)
      throw new ConvexError("PAYMENT_PROVIDER_MISMATCH");
    const status =
      attempt.status === "paid" || args.status === "paid"
        ? "paid"
        : attempt.status === "failed" || args.status === "failed"
          ? "failed"
          : "pending";
    await ctx.db.patch(attempt._id, {
      providerSessionId: args.providerSessionId,
      ...(args.providerPaymentIntentId
        ? { providerPaymentIntentId: args.providerPaymentIntentId }
        : {}),
      ...(args.checkoutUrl ? { checkoutUrl: args.checkoutUrl } : {}),
      providerStatus: args.providerStatus,
      status,
      updatedAt: Date.now(),
    });
    return {
      attempt: (await ctx.db.get(attempt._id))!,
      reconciliationRequired:
        bookingChanged || (!!paidSibling && paidSibling._id !== attempt._id),
      reason: bookingChanged ? "BOOKING_CHANGED" : "SUPERSEDED_PAYMENT",
    };
  },
});

export const reconcile = internalMutation({
  args: {
    providerEventId: v.string(),
    providerCreated: v.number(),
    providerType: v.string(),
    attemptId: v.id("paymentAttempts"),
    tenantId: v.id("tenants"),
    bookingId: v.id("bookings"),
    providerSessionId: v.string(),
    providerPaymentIntentId: v.optional(v.string()),
    amountMinor: v.number(),
    currency: v.string(),
    providerStatus: v.string(),
    status: v.union(v.literal("pending"), v.literal("failed"), v.literal("paid")),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (
      !attempt ||
      attempt.tenantId !== args.tenantId ||
      attempt.bookingId !== args.bookingId ||
      (attempt.providerSessionId !== undefined &&
        attempt.providerSessionId !== args.providerSessionId) ||
      attempt.amountMinor !== args.amountMinor ||
      attempt.currency.toLowerCase() !== args.currency.toLowerCase()
    )
      throw new ConvexError("PAYMENT_PROVIDER_MISMATCH");
    const assigned = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_provider_session", (q) =>
        q.eq("providerSessionId", args.providerSessionId),
      )
      .unique();
    if (assigned && assigned._id !== attempt._id)
      throw new ConvexError("PAYMENT_PROVIDER_MISMATCH");
    const processed = await ctx.db
      .query("paymentEvents")
      .withIndex("by_provider_event", (q) =>
        q.eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (processed)
      return {
        duplicate: true,
        status: attempt.status,
        competing:
          attempt.status === "paid"
            ? await competingSessions(ctx, attempt)
            : [],
      };
    await ctx.db.insert("paymentEvents", {
      providerEventId: args.providerEventId,
      providerCreated: args.providerCreated,
      providerType: args.providerType,
      tenantId: args.tenantId,
      attemptId: attempt._id,
      processedAt: Date.now(),
    });
    const status =
      attempt.status === "paid" || args.status === "paid"
        ? "paid"
        : attempt.status === "failed" || args.status === "failed"
          ? "failed"
          : "pending";
    await ctx.db.patch(attempt._id, {
      providerSessionId: args.providerSessionId,
      ...(args.providerPaymentIntentId
        ? { providerPaymentIntentId: args.providerPaymentIntentId }
        : {}),
      providerStatus: args.providerStatus,
      status,
      ...(status === "failed" ? { failureCode: args.providerType } : {}),
      updatedAt: Date.now(),
    });
    return {
      duplicate: false,
      status,
      competing: status === "paid" ? await competingSessions(ctx, attempt) : [],
    };
  },
});

export const applyProviderSnapshot = internalMutation({
  args: {
    attemptId: v.id("paymentAttempts"),
    tenantId: v.id("tenants"),
    bookingId: v.id("bookings"),
    providerSessionId: v.string(),
    providerPaymentIntentId: v.optional(v.string()),
    amountMinor: v.number(),
    currency: v.string(),
    providerStatus: v.string(),
    status: v.union(v.literal("pending"), v.literal("failed"), v.literal("paid")),
    failureCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (
      !attempt ||
      attempt.tenantId !== args.tenantId ||
      attempt.bookingId !== args.bookingId ||
      (attempt.providerSessionId !== undefined &&
        attempt.providerSessionId !== args.providerSessionId) ||
      attempt.amountMinor !== args.amountMinor ||
      attempt.currency.toLowerCase() !== args.currency.toLowerCase()
    )
      throw new ConvexError("PAYMENT_PROVIDER_MISMATCH");
    const assigned = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_provider_session", (q) =>
        q.eq("providerSessionId", args.providerSessionId),
      )
      .unique();
    if (assigned && assigned._id !== attempt._id)
      throw new ConvexError("PAYMENT_PROVIDER_MISMATCH");
    const status =
      attempt.status === "paid" || args.status === "paid"
        ? "paid"
        : attempt.status === "failed" || args.status === "failed"
          ? "failed"
          : "pending";
    await ctx.db.patch(attempt._id, {
      providerSessionId: args.providerSessionId,
      ...(args.providerPaymentIntentId
        ? { providerPaymentIntentId: args.providerPaymentIntentId }
        : {}),
      providerStatus: args.providerStatus,
      status,
      ...(args.failureCode ? { failureCode: args.failureCode } : {}),
      updatedAt: Date.now(),
    });
    return { status };
  },
});
