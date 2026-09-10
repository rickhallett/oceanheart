import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import {
  assertStripeAccount,
  checkoutAttemptStatus,
  createStripeCheckout,
  retrieveStripeCheckout,
  settleSupersededCheckout,
  stripeConfig,
  type StripeCheckoutSession,
} from "./lib/stripeProvider";
import { requireMember } from "./lib/access";

export const availability = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    try {
      stripeConfig();
      return { enabled: true };
    } catch {
      return { enabled: false };
    }
  },
});

function assertSession(
  session: StripeCheckoutSession,
  attempt: Doc<"paymentAttempts">,
) {
  if (
    session.client_reference_id !== attempt._id ||
    session.metadata?.attemptId !== attempt._id ||
    session.metadata?.tenantId !== attempt.tenantId ||
    session.metadata?.bookingId !== attempt.bookingId ||
    session.amount_total !== attempt.amountMinor ||
    session.currency?.toUpperCase() !== attempt.currency
  )
    throw new ConvexError("PAYMENT_PROVIDER_MISMATCH");
}

function result(attempt: Doc<"paymentAttempts">) {
  return {
    attemptId: attempt._id,
    status: attempt.status,
    ...(attempt.status === "pending" && attempt.checkoutUrl
      ? { checkoutUrl: attempt.checkoutUrl }
      : {}),
  };
}

export const startCheckout = action({
  args: {
    tenantId: v.id("tenants"),
    bookingId: v.id("bookings"),
    requestKey: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    attemptId: Id<"paymentAttempts">;
    status: "creating" | "pending" | "failed" | "paid";
    checkoutUrl?: string;
  }> => {
    try {
      await ctx.runQuery(internal.paymentsInternal.authorizeStart, {
        tenantId: args.tenantId,
      });
      // Configuration is checked before reserving a durable attempt. A disabled
      // environment must expose neither Checkout nor payment-shaped writes.
      const config = stripeConfig();
      let attempt = await ctx.runMutation(internal.paymentsInternal.reserve, args);
      const guarded = await ctx.runMutation(
        internal.paymentsInternal.guardCheckout,
        { tenantId: args.tenantId, attemptId: attempt._id },
      );
      attempt = guarded.attempt;
      if (attempt.status === "paid") return result(attempt);
      if (guarded.reconciliationRequired) {
        if (attempt.providerSessionId) {
          await assertStripeAccount(config);
          const settled = await settleSupersededCheckout(
            config,
            attempt.providerSessionId,
            `supersede:${attempt._id}`,
          );
          assertSession(settled, attempt);
          const status = checkoutAttemptStatus(settled);
          await ctx.runMutation(
            internal.paymentsInternal.applyProviderSnapshot,
            {
              tenantId: attempt.tenantId,
              bookingId: attempt.bookingId,
              attemptId: attempt._id,
              providerSessionId: settled.id,
              ...(settled.payment_intent
                ? { providerPaymentIntentId: settled.payment_intent }
                : {}),
              amountMinor: settled.amount_total!,
              currency: settled.currency!,
              providerStatus: `${settled.status}:${settled.payment_status}`,
              status,
              ...(status === "failed"
                ? { failureCode: guarded.reason }
                : {}),
            },
          );
        }
        throw new ConvexError("PAYMENT_RECONCILIATION_REQUIRED");
      }
      if (attempt.status === "failed")
        throw new ConvexError("PAYMENT_ATTEMPT_FAILED");
      if (attempt.checkoutUrl) return result(attempt);
      await assertStripeAccount(config);
      let session: StripeCheckoutSession;
      if (attempt.providerSessionId) {
        session = await retrieveStripeCheckout(config, attempt.providerSessionId);
      } else {
        session = await createStripeCheckout(config, {
          attemptId: attempt._id,
          tenantId: attempt.tenantId,
          bookingId: attempt.bookingId,
          idempotencyKey: attempt.providerIdempotencyKey,
          serviceName: attempt.serviceName,
          amountMinor: attempt.amountMinor,
          currency: attempt.currency,
        });
      }
      assertSession(session, attempt);
      const attached = await ctx.runMutation(internal.paymentsInternal.attachSession, {
        tenantId: attempt.tenantId,
        attemptId: attempt._id,
        providerSessionId: session.id,
        ...(session.payment_intent
          ? { providerPaymentIntentId: session.payment_intent }
          : {}),
        ...(session.url ? { checkoutUrl: session.url } : {}),
        providerStatus: `${session.status}:${session.payment_status}`,
        status: checkoutAttemptStatus(session),
      });
      attempt = attached.attempt;
      if (attached.reconciliationRequired) {
        const settled = await settleSupersededCheckout(
          config,
          session.id,
          `supersede:${attempt._id}`,
        );
        assertSession(settled, attempt);
        const status = checkoutAttemptStatus(settled);
        await ctx.runMutation(internal.paymentsInternal.applyProviderSnapshot, {
          tenantId: attempt.tenantId,
          bookingId: attempt.bookingId,
          attemptId: attempt._id,
          providerSessionId: settled.id,
          ...(settled.payment_intent
            ? { providerPaymentIntentId: settled.payment_intent }
            : {}),
          amountMinor: settled.amount_total!,
          currency: settled.currency!,
          providerStatus: `${settled.status}:${settled.payment_status}`,
          status,
          ...(status === "failed" ? { failureCode: attached.reason } : {}),
        });
        throw new ConvexError("PAYMENT_RECONCILIATION_REQUIRED");
      }
      return result(attempt);
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      const code =
        error instanceof Error && error.message === "PAYMENTS_NOT_CONFIGURED"
          ? "PAYMENTS_NOT_CONFIGURED"
          : "PAYMENT_PROVIDER_UNAVAILABLE";
      throw new ConvexError(code);
    }
  },
});
