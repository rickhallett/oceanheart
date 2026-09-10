import { afterEach, expect, it, vi } from "vitest";
import {
  assertStripeAccount,
  checkoutAttemptStatus,
  createStripeCheckout,
  retrieveStripeCheckout,
  settleSupersededCheckout,
  stripeConfig,
  type StripeCheckoutSession,
  type StripeConfig,
} from "../../backend/convex/lib/stripeProvider";

const config: StripeConfig = {
  secretKey: "sk_test_private",
  webhookSecret: "whsec_private",
  accountId: "acct_expected",
  apiVersion: "2026-08-27.test",
  appOrigin: "https://studio-staging.example",
};

afterEach(() => vi.unstubAllGlobals());

it("creates test Checkout with the durable key and only server-bound booked terms", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "cs_test_checkout",
        object: "checkout.session",
        livemode: false,
        mode: "payment",
        status: "open",
        payment_status: "unpaid",
        amount_total: 6250,
        currency: "gbp",
        client_reference_id: "attempt",
        payment_intent: null,
        url: "https://checkout.stripe.com/c/pay/test",
        metadata: {
          attemptId: "attempt",
          tenantId: "tenant",
          bookingId: "booking",
        },
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  await createStripeCheckout(config, {
    attemptId: "attempt",
    tenantId: "tenant",
    bookingId: "booking",
    idempotencyKey: "stable-attempt-key",
    serviceName: "Consultation",
    amountMinor: 6250,
    currency: "GBP",
  });
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
  expect(init.headers["Idempotency-Key"]).toBe("stable-attempt-key");
  expect(init.body.get("line_items[0][price_data][unit_amount]")).toBe("6250");
  expect(init.body.get("line_items[0][price_data][currency]")).toBe("gbp");
  expect(init.body.get("success_url")).toBe(
    "https://studio-staging.example/app/calendar?checkout=return",
  );
  expect(init.body.get("metadata[tenantId]")).toBe("tenant");
});

it("expires a superseded open Checkout with its own stable suppression key", async () => {
  const base = {
    id: "cs_test_superseded",
    object: "checkout.session",
    livemode: false,
    mode: "payment",
    payment_status: "unpaid",
    amount_total: 6250,
    currency: "gbp",
    client_reference_id: "attempt",
    payment_intent: null,
    url: "https://checkout.stripe.com/c/pay/test",
    metadata: { attemptId: "attempt", tenantId: "tenant", bookingId: "booking" },
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...base, status: "open" }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...base, status: "expired", url: null }), {
        status: 200,
      }),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    settleSupersededCheckout(config, base.id, "supersede-stable"),
  ).resolves.toMatchObject({ status: "expired", payment_status: "unpaid" });
  expect(fetch.mock.calls[1][0]).toBe(
    `https://api.stripe.com/v1/checkout/sessions/${base.id}/expire`,
  );
  expect(fetch.mock.calls[1][1].headers["Idempotency-Key"]).toBe(
    "supersede-stable",
  );
  expect(
    checkoutAttemptStatus({ ...base, status: "complete" } as StripeCheckoutSession),
  ).toBe("pending");
  expect(
    checkoutAttemptStatus({ ...base, status: "expired" } as StripeCheckoutSession),
  ).toBe("failed");
});

it("fails closed on live configuration, account mismatch and non-test sessions", async () => {
  const keys = [
    "STRIPE_PAYMENTS_MODE",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_EXPECTED_ACCOUNT_ID",
    "STRIPE_API_VERSION",
    "STUDIO_APP_ORIGIN",
  ] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.STRIPE_PAYMENTS_MODE = "test";
    process.env.STRIPE_SECRET_KEY = "sk_live_forbidden";
    process.env.STRIPE_WEBHOOK_SECRET = config.webhookSecret;
    process.env.STRIPE_EXPECTED_ACCOUNT_ID = config.accountId;
    process.env.STRIPE_API_VERSION = config.apiVersion;
    process.env.STUDIO_APP_ORIGIN = config.appOrigin;
    expect(() => stripeConfig()).toThrow("PAYMENTS_NOT_CONFIGURED");
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "acct_other" }), { status: 200 }),
    ),
  );
  await expect(assertStripeAccount(config)).rejects.toThrow(
    "STRIPE_ACCOUNT_MISMATCH",
  );
  await expect(retrieveStripeCheckout(config, "cs_live_forbidden")).rejects.toThrow(
    "INVALID_STRIPE_SESSION",
  );
});
