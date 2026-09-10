# Stripe test booking payments

RIC-111's first child is owner-initiated collection for an existing linked
booking. It is not a public booking flow or client portal. Checkout always uses
the booking's immutable `serviceSnapshot.priceMinor` and `GBP`; browser-supplied
prices, currencies, tenants and return-page state are never payment evidence.

The action reserves a durable attempt before calling Stripe and reuses its
stable provider idempotency key. The `/stripe-webhook` HTTP action verifies the
raw signed body, rejects live-mode or unexpected API-version events, retrieves
the authoritative Checkout Session from the configured test account, and then
applies a deduplicated monotonic transition. A paid attempt is never downgraded.
Changing or cancelling a booking preserves payment truth, flags reconciliation,
and blocks genuinely new collection while the original request remains
replayable. If an older failed attempt is later confirmed paid after a retry was
opened, the row remains explicitly reconciliation-required. The webhook tries
to expire the superseding open Checkout through the same verified test account;
if Stripe already confirms both paid, both durable attempts remain recorded and
the anomaly is never collapsed into a normal paid state.
`complete:unpaid` remains pending because delayed payment processing can still
resolve; only an expired session or signed asynchronous-failure event is failed.

## Required staging configuration

Configure these only on the staging Convex deployment; do not place values in
the repository or frontend environment:

- `STRIPE_PAYMENTS_MODE=test`
- `STRIPE_SECRET_KEY` (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- `STRIPE_EXPECTED_ACCOUNT_ID` (`acct_...`)
- `STRIPE_API_VERSION` (the pinned version used by the webhook endpoint)
- `STUDIO_APP_ORIGIN` (the exact HTTPS staging frontend origin)

Register `https://<staging-deployment>.convex.site/stripe-webhook` for
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired`.
Provider readiness is unverified until the selected Stripe test account,
endpoint secret and pinned version are confirmed together through the hosted
Checkout → signed webhook → reload journey.
