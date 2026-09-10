export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  accountId: string;
  apiVersion: string;
  appOrigin: string;
};

export type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  livemode: boolean;
  mode: "payment";
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  payment_intent: string | null;
  url: string | null;
  metadata: Record<string, string> | null;
};

export function checkoutAttemptStatus(session: StripeCheckoutSession) {
  if (session.payment_status === "paid") return "paid" as const;
  if (session.status === "expired") return "failed" as const;
  return "pending" as const;
}

function configured(value: string | undefined, pattern: RegExp) {
  if (!value || !pattern.test(value)) throw new Error("PAYMENTS_NOT_CONFIGURED");
  return value;
}

export function stripeConfig(): StripeConfig {
  if (process.env.STRIPE_PAYMENTS_MODE !== "test")
    throw new Error("PAYMENTS_NOT_CONFIGURED");
  const origin = configured(process.env.STUDIO_APP_ORIGIN, /^https:\/\//);
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new Error("PAYMENTS_NOT_CONFIGURED");
  return {
    secretKey: configured(process.env.STRIPE_SECRET_KEY, /^sk_test_[A-Za-z0-9_]+$/),
    webhookSecret: configured(process.env.STRIPE_WEBHOOK_SECRET, /^whsec_[A-Za-z0-9_]+$/),
    accountId: configured(process.env.STRIPE_EXPECTED_ACCOUNT_ID, /^acct_[A-Za-z0-9]+$/),
    apiVersion: configured(process.env.STRIPE_API_VERSION, /^\d{4}-\d{2}-\d{2}(?:\.[a-z0-9_-]+)?$/),
    appOrigin: url.origin,
  };
}

async function stripeRequest<T>(
  config: StripeConfig,
  path: string,
  init: { body?: URLSearchParams; idempotencyKey?: string } = {},
): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": config.apiVersion,
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    ...(init.body ? { body: init.body } : {}),
  });
  if (!response.ok) throw new Error("STRIPE_UNAVAILABLE");
  return (await response.json()) as T;
}

export async function assertStripeAccount(config: StripeConfig) {
  const account = await stripeRequest<{ id?: string }>(config, "account");
  if (account.id !== config.accountId) throw new Error("STRIPE_ACCOUNT_MISMATCH");
}

export async function createStripeCheckout(
  config: StripeConfig,
  attempt: {
    attemptId: string;
    tenantId: string;
    bookingId: string;
    idempotencyKey: string;
    serviceName: string;
    amountMinor: number;
    currency: "GBP";
  },
) {
  const metadata = {
    attemptId: attempt.attemptId,
    tenantId: attempt.tenantId,
    bookingId: attempt.bookingId,
  };
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${config.appOrigin}/app/calendar?checkout=return`,
    cancel_url: `${config.appOrigin}/app/calendar?checkout=cancel`,
    client_reference_id: attempt.attemptId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": attempt.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(attempt.amountMinor),
    "line_items[0][price_data][product_data][name]": attempt.serviceName,
  });
  for (const [key, value] of Object.entries(metadata)) {
    body.set(`metadata[${key}]`, value);
    body.set(`payment_intent_data[metadata][${key}]`, value);
  }
  const session = await stripeRequest<StripeCheckoutSession>(
    config,
    "checkout/sessions",
    { body, idempotencyKey: attempt.idempotencyKey },
  );
  assertTestCheckout(session);
  return session;
}

export async function retrieveStripeCheckout(
  config: StripeConfig,
  sessionId: string,
) {
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId))
    throw new Error("INVALID_STRIPE_SESSION");
  const session = await stripeRequest<StripeCheckoutSession>(
    config,
    `checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
  assertTestCheckout(session);
  return session;
}

export async function settleSupersededCheckout(
  config: StripeConfig,
  sessionId: string,
  idempotencyKey: string,
) {
  let session = await retrieveStripeCheckout(config, sessionId);
  if (session.payment_status === "paid" || session.status !== "open")
    return session;
  session = await stripeRequest<StripeCheckoutSession>(
    config,
    `checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
    { body: new URLSearchParams(), idempotencyKey },
  );
  assertTestCheckout(session);
  if (session.id !== sessionId || session.status === "open")
    throw new Error("STRIPE_RESPONSE_MISMATCH");
  return session;
}

function assertTestCheckout(session: StripeCheckoutSession) {
  if (
    session.object !== "checkout.session" ||
    !/^cs_test_[A-Za-z0-9_]+$/.test(session.id) ||
    session.livemode ||
    session.mode !== "payment"
  )
    throw new Error("STRIPE_RESPONSE_MISMATCH");
  if (session.url) {
    const url = new URL(session.url);
    if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
      throw new Error("STRIPE_RESPONSE_MISMATCH");
  }
}
