import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  assertStripeAccount,
  checkoutAttemptStatus,
  retrieveStripeCheckout,
  settleSupersededCheckout,
  stripeConfig,
} from "./lib/stripeProvider";
import { verifyStripeWebhook } from "./lib/stripeWebhook";

const handled = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

const stripeWebhook = httpAction(async (ctx, request) => {
  const payload = await request.text();
  try {
    const config = stripeConfig();
    const event = await verifyStripeWebhook(
      payload,
      request.headers.get("stripe-signature"),
      config.webhookSecret,
    );
    if (event.livemode || event.api_version !== config.apiVersion)
      return new Response("Rejected Stripe mode or API version", { status: 400 });
    if (!handled.has(event.type)) return new Response("Ignored", { status: 200 });
    const sessionId = event.data.object.id;
    if (!sessionId) return new Response("Invalid Stripe event", { status: 400 });
    await assertStripeAccount(config);
    const session = await retrieveStripeCheckout(config, sessionId);
    const attemptId = session.metadata?.attemptId,
      tenantId = session.metadata?.tenantId,
      bookingId = session.metadata?.bookingId;
    if (
      !attemptId ||
      !tenantId ||
      !bookingId ||
      session.client_reference_id !== attemptId ||
      session.amount_total === null ||
      !Number.isSafeInteger(session.amount_total) ||
      !session.currency
    )
      return new Response("Invalid Checkout binding", { status: 400 });
    const status =
      session.payment_status === "paid"
        ? ("paid" as const)
        : session.status === "expired" ||
            event.type === "checkout.session.async_payment_failed"
          ? ("failed" as const)
          : ("pending" as const);
    const reconciliation = await ctx.runMutation(internal.paymentsInternal.reconcile, {
      providerEventId: event.id,
      providerCreated: event.created,
      providerType: event.type,
      attemptId: attemptId as Id<"paymentAttempts">,
      tenantId: tenantId as Id<"tenants">,
      bookingId: bookingId as Id<"bookings">,
      providerSessionId: session.id,
      ...(session.payment_intent
        ? { providerPaymentIntentId: session.payment_intent }
        : {}),
      amountMinor: session.amount_total,
      currency: session.currency,
      providerStatus: `${session.status}:${session.payment_status}`,
      status,
    });
    for (const competing of reconciliation.competing) {
      const settled = await settleSupersededCheckout(
        config,
        competing.providerSessionId,
        `supersede:${event.id}:${competing.attemptId}`,
      );
      if (
        settled.client_reference_id !== competing.attemptId ||
        settled.metadata?.attemptId !== competing.attemptId ||
        settled.metadata?.tenantId !== competing.tenantId ||
        settled.metadata?.bookingId !== competing.bookingId ||
        settled.amount_total !== competing.amountMinor ||
        settled.currency?.toUpperCase() !== competing.currency
      )
        throw new Error("STRIPE_RESPONSE_MISMATCH");
      const competingStatus = checkoutAttemptStatus(settled);
      await ctx.runMutation(internal.paymentsInternal.applyProviderSnapshot, {
        attemptId: competing.attemptId,
        tenantId: competing.tenantId,
        bookingId: competing.bookingId,
        providerSessionId: settled.id,
        ...(settled.payment_intent
          ? { providerPaymentIntentId: settled.payment_intent }
          : {}),
        amountMinor: settled.amount_total,
        currency: settled.currency,
        providerStatus: `${settled.status}:${settled.payment_status}`,
        status: competingStatus,
        ...(competingStatus === "failed"
          ? { failureCode: "SUPERSEDED_PAYMENT" }
          : {}),
      });
    }
    return new Response("Accepted", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message === "INVALID_STRIPE_SIGNATURE" ||
      message === "INVALID_STRIPE_EVENT"
    )
      return new Response("Invalid Stripe signature", { status: 400 });
    return new Response("Stripe webhook unavailable", { status: 500 });
  }
});

const http = httpRouter();
http.route({ path: "/stripe-webhook", method: "POST", handler: stripeWebhook });
export default http;
