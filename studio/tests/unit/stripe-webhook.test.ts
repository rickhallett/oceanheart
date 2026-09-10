import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { verifyStripeWebhook } from "../../backend/convex/lib/stripeWebhook";

const secret = "whsec_test_secret";
const timestamp = 1_800_000_000;
const payload = JSON.stringify({
  id: "evt_test_payment",
  type: "checkout.session.completed",
  created: timestamp,
  livemode: false,
  api_version: "2026-08-27.test",
  data: { object: { id: "cs_test_payment" } },
});
const signature = (body = payload, at = timestamp) =>
  createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");

it("accepts the exact raw Stripe body and one matching v1 signature", async () => {
  await expect(
    verifyStripeWebhook(
      payload,
      `t=${timestamp},v1=${"0".repeat(64)},v1=${signature()}`,
      secret,
      timestamp,
    ),
  ).resolves.toMatchObject({ id: "evt_test_payment", livemode: false });
});

it("rejects altered bodies, stale timestamps and malformed events", async () => {
  await expect(
    verifyStripeWebhook(
      `${payload} `,
      `t=${timestamp},v1=${signature()}`,
      secret,
      timestamp,
    ),
  ).rejects.toThrow("INVALID_STRIPE_SIGNATURE");
  await expect(
    verifyStripeWebhook(
      payload,
      `t=${timestamp},v1=${signature()}`,
      secret,
      timestamp + 301,
    ),
  ).rejects.toThrow("INVALID_STRIPE_SIGNATURE");
  const malformed = JSON.stringify({ id: "not-an-event" });
  await expect(
    verifyStripeWebhook(
      malformed,
      `t=${timestamp},v1=${signature(malformed)}`,
      secret,
      timestamp,
    ),
  ).rejects.toThrow("INVALID_STRIPE_EVENT");
});
