import assert from "node:assert/strict";

export async function paymentChecks({
  alice,
  bob,
  viewer,
  anonymous,
  viewerIdentity,
  clientForOwner,
  check,
  prefix,
}) {
  const tenantId = await alice.mutation("tenants:create", {
    name: `Payments ${prefix}`,
    requestKey: `${prefix}-tenant`,
  });
  await alice.mutation("tenants:addViewer", { tenantId, identity: viewerIdentity });
  await alice.mutation("tenants:setTimeZone", {
    tenantId,
    timeZone: "Europe/London",
    expectedTimeZone: null,
  });
  const clientId = await alice.mutation("clients:create", {
    tenantId,
    name: "Payment client",
    requestKey: `${prefix}-client`,
  });
  const serviceId = await alice.mutation("services:create", {
    tenantId,
    name: "Payment consultation",
    durationMinutes: 60,
    priceMinor: 6250,
    currency: "GBP",
    requestKey: `${prefix}-service`,
  });
  const startsAt = Date.UTC(2042, 0, 6, 10);
  const bookingId = await alice.mutation("bookings:createLinked", {
    tenantId,
    clientId,
    serviceId,
    startsAt,
    requestKey: `${prefix}-booking`,
  });
  const transition = (caller, name, args) =>
    caller.action("paymentTest:transition", { name, args });
  const reserveArgs = {
    tenantId,
    bookingId,
    requestKey: `${prefix}-attempt`,
  };
  assert.deepEqual(
    await alice.query("payments:availability", { tenantId }),
    { enabled: false },
  );
  await assert.rejects(
    alice.action("payments:startCheckout", reserveArgs),
    /PAYMENTS_NOT_CONFIGURED/,
  );
  assert.equal(
    (await alice.query("bookings:list", {
      tenantId,
      from: startsAt,
      to: startsAt + 86_400_000,
    })).items[0].payment,
    undefined,
  );
  check("disabled payment environments reject before creating a durable attempt");
  for (const [caller, code] of [
    [anonymous, "UNAUTHENTICATED"],
    [viewer, "FORBIDDEN"],
    [bob, "FORBIDDEN"],
  ])
    await assert.rejects(transition(caller, "reserve", reserveArgs), new RegExp(code));
  const attempt = await transition(alice, "reserve", reserveArgs);
  assert.equal((await transition(alice, "reserve", reserveArgs))._id, attempt._id);
  const listed = await alice.query("bookings:list", {
    tenantId,
    from: startsAt,
    to: startsAt + 86_400_000,
  });
  assert.deepEqual(listed.items[0].payment, {
    attemptId: attempt._id,
    status: "creating",
    amountMinor: 6250,
    currency: "GBP",
    reconciliationRequired: false,
  });
  check("payment reservation is owner-only, tenant-bound, retry-safe and priced from the immutable booked GBP snapshot");

  const concurrentBookingId = await alice.mutation("bookings:createLinked", {
    tenantId,
    clientId,
    serviceId,
    startsAt: startsAt + 86_400_000,
    requestKey: `${prefix}-concurrent-booking`,
  });
  const contenders = await Promise.all(
    Array.from({ length: 8 }, () => clientForOwner()),
  );
  const concurrent = await Promise.all(
    contenders.map((caller, index) =>
      transition(caller, "reserve", {
        tenantId,
        bookingId: concurrentBookingId,
        requestKey: `${prefix}-parallel-${index}`,
      }),
    ),
  );
  assert.equal(new Set(concurrent.map(({ _id }) => _id)).size, 1);
  check("parallel checkout reservations converge on one durable attempt before any provider effect");

  const firstRetryAttempt = concurrent[0];
  const retryEvent = (providerEventId, status) =>
    transition(alice, "reconcile", {
      providerEventId,
      providerCreated: 1_800_000_000,
      providerType:
        status === "paid"
          ? "checkout.session.async_payment_succeeded"
          : "checkout.session.async_payment_failed",
      attemptId: firstRetryAttempt._id,
      tenantId,
      bookingId: concurrentBookingId,
      providerSessionId: "cs_test_retry_session",
      providerPaymentIntentId: "pi_test_retry",
      amountMinor: 6250,
      currency: "gbp",
      providerStatus: status === "paid" ? "complete:paid" : "complete:unpaid",
      status,
    });
  await retryEvent("evt_test_retry_failed", "failed");
  const secondRetryAttempt = await transition(alice, "reserve", {
    tenantId,
    bookingId: concurrentBookingId,
    requestKey: `${prefix}-retry-after-failure`,
  });
  assert.notEqual(secondRetryAttempt._id, firstRetryAttempt._id);
  await transition(alice, "attach", {
    tenantId,
    attemptId: secondRetryAttempt._id,
    providerSessionId: "cs_test_retry_second_session",
    checkoutUrl: "https://checkout.stripe.com/c/pay/retry",
    providerStatus: "open:unpaid",
    status: "pending",
  });
  await retryEvent("evt_test_retry_late_paid", "paid");
  const guardedRetry = await transition(alice, "guard", {
    tenantId,
    attemptId: secondRetryAttempt._id,
  });
  assert.equal(guardedRetry.reconciliationRequired, true);
  assert.equal(guardedRetry.reason, "SUPERSEDED_PAYMENT");
  assert.equal(guardedRetry.attempt.checkoutUrl, "https://checkout.stripe.com/c/pay/retry");
  let retryList = await alice.query("bookings:list", {
    tenantId,
    from: startsAt + 86_400_000,
    to: startsAt + 2 * 86_400_000,
  });
  assert.equal(retryList.items[0].payment.attemptId, firstRetryAttempt._id);
  assert.equal(retryList.items[0].payment.status, "paid");
  assert.equal(retryList.items[0].payment.reconciliationRequired, true);
  await transition(alice, "reconcile", {
    providerEventId: "evt_test_retry_second_late_paid",
    providerCreated: 1_800_000_001,
    providerType: "checkout.session.async_payment_succeeded",
    attemptId: secondRetryAttempt._id,
    tenantId,
    bookingId: concurrentBookingId,
    providerSessionId: "cs_test_retry_second_session",
    providerPaymentIntentId: "pi_test_retry_second",
    amountMinor: 6250,
    currency: "gbp",
    providerStatus: "complete:paid",
    status: "paid",
  });
  retryList = await alice.query("bookings:list", {
    tenantId,
    from: startsAt + 86_400_000,
    to: startsAt + 2 * 86_400_000,
  });
  assert.equal(retryList.items[0].payment.status, "paid");
  assert.equal(retryList.items[0].payment.reconciliationRequired, true);
  check("A-failed, B-attached, A-late-paid and B-late-paid remain explicit reconciliation anomalies and block further collection");

  const session = {
    tenantId,
    attemptId: attempt._id,
    providerSessionId: "cs_test_payment_session",
    checkoutUrl: "https://checkout.stripe.com/c/pay/test",
    providerStatus: "open:unpaid",
    status: "pending",
  };
  await transition(alice, "attach", session);
  await assert.rejects(
    transition(alice, "attach", {
      ...session,
      providerSessionId: "cs_test_different_session",
    }),
    /PAYMENT_PROVIDER_MISMATCH/,
  );
  assert.equal((await transition(alice, "reserve", { ...reserveArgs, requestKey: `${prefix}-another-key` }))._id, attempt._id);
  await alice.mutation("bookings:reschedule", {
    tenantId,
    bookingId,
    startsAt: startsAt + 2 * 86_400_000,
    expectedRevision: 0,
  });
  assert.deepEqual(
    (({ reconciliationRequired, reason }) => ({ reconciliationRequired, reason }))(
      await transition(alice, "guard", { tenantId, attemptId: attempt._id }),
    ),
    { reconciliationRequired: true, reason: "BOOKING_CHANGED" },
  );
  await assert.rejects(
    transition(alice, "reserve", { ...reserveArgs, requestKey: `${prefix}-changed-booking` }),
    /PAYMENT_RECONCILIATION_REQUIRED/,
  );
  assert.equal((await transition(alice, "reserve", reserveArgs))._id, attempt._id);
  check("a changed booking blocks genuinely new checkout while its original attempt receipt remains replayable");

  const reconcile = (providerEventId, status, overrides = {}) =>
    transition(alice, "reconcile", {
      providerEventId,
      providerCreated: 1_800_000_000,
      providerType:
        status === "paid"
          ? "checkout.session.async_payment_succeeded"
          : status === "failed"
            ? "checkout.session.async_payment_failed"
            : "checkout.session.completed",
      attemptId: attempt._id,
      tenantId,
      bookingId,
      providerSessionId: session.providerSessionId,
      providerPaymentIntentId: "pi_test_payment",
      amountMinor: 6250,
      currency: "gbp",
      providerStatus:
        status === "paid" ? "complete:paid" : status === "failed" ? "complete:unpaid" : "open:unpaid",
      status,
      ...overrides,
    });
  await assert.rejects(
    reconcile("evt_test_bad_amount", "paid", { amountMinor: 1 }),
    /PAYMENT_PROVIDER_MISMATCH/,
  );
  await reconcile("evt_test_failed", "failed");
  await reconcile("evt_test_stale_pending", "pending");
  assert.equal((await transition(alice, "current", { tenantId, attemptId: attempt._id })).status, "failed");
  await reconcile("evt_test_paid", "paid");
  await reconcile("evt_test_late_failed", "failed");
  const duplicate = await reconcile("evt_test_paid", "paid");
  assert.equal(duplicate.duplicate, true);
  assert.equal((await transition(alice, "current", { tenantId, attemptId: attempt._id })).status, "paid");
  check("provider events validate booked amount, dedupe exact IDs and reconcile out of order without downgrading paid truth");

  await alice.mutation("bookings:cancel", {
    tenantId,
    bookingId,
    expectedRevision: 1,
  });
  const afterCancel = await alice.query("bookings:list", {
    tenantId,
    from: startsAt + 2 * 86_400_000,
    to: startsAt + 3 * 86_400_000,
  });
  assert.equal(afterCancel.items[0].payment.status, "paid");
  assert.equal(afterCancel.items[0].payment.reconciliationRequired, true);
  assert.equal((await transition(alice, "reserve", reserveArgs))._id, attempt._id);
  await assert.rejects(
    transition(alice, "reserve", { ...reserveArgs, requestKey: `${prefix}-cancelled-new` }),
    /PAYMENT_RECONCILIATION_REQUIRED/,
  );
  check("later cancellation preserves confirmed payment truth, flags reconciliation and blocks new collection without breaking the original retry");

  const legacyId = await alice.mutation("bookings:create", {
    tenantId,
    practitionerId: "practice",
    startsAt: startsAt + 4 * 86_400_000,
    endsAt: startsAt + 4 * 86_400_000 + 3_600_000,
    clientLabel: "Legacy payment denial",
    requestKey: `${prefix}-legacy`,
  });
  await assert.rejects(
    transition(alice, "reserve", {
      tenantId,
      bookingId: legacyId,
      requestKey: `${prefix}-legacy-attempt`,
    }),
    /PAYMENT_LINKED_BOOKING_REQUIRED/,
  );
  check("legacy unlinked bookings cannot enter payment collection");
}
