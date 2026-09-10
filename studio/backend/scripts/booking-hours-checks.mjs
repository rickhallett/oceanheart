import assert from "node:assert/strict";

const closedWeek = (overrides = {}) => ({
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null,
  saturday: null,
  sunday: null,
  ...overrides,
});
const hour = 60 * 60 * 1000;
const at = (value) => Date.parse(value);

export async function bookingHoursChecks({
  alice,
  bob,
  viewer,
  check,
  prefix,
}) {
  const tenantId = await alice.mutation("tenants:create", {
    name: `Hours ${prefix}`,
    requestKey: `${prefix}-tenant`,
  });
  const londonWeek = closedWeek({
    monday: { open: "09:00", close: "17:00" },
  });
  const settings = (expectedRevision, availability, enforceBookingHours) => ({
    tenantId,
    name: `Hours ${prefix}`,
    availability,
    enforceBookingHours,
    expectedRevision,
    expectedTimeZone: "Europe/London",
  });
  await assert.rejects(
    alice.mutation("settings:update", {
      ...settings(0, londonWeek, true),
      expectedTimeZone: null,
    }),
    /TIME_ZONE_REQUIRED/,
  );
  await alice.mutation("tenants:setTimeZone", {
    tenantId,
    timeZone: "Europe/London",
    expectedTimeZone: null,
  });
  assert.equal(
    await alice.mutation("settings:update", settings(0, londonWeek, false)),
    1,
  );
  check("practice-hours opt-in requires a saved practice time zone and defaults off");

  const clientId = await alice.mutation("clients:create", {
    tenantId,
    name: "Hours client",
    requestKey: `${prefix}-client`,
  });
  const serviceId = await alice.mutation("services:create", {
    tenantId,
    name: "One hour",
    durationMinutes: 60,
    priceMinor: 9000,
    currency: "GBP",
    requestKey: `${prefix}-service-60`,
  });
  const shortServiceId = await alice.mutation("services:create", {
    tenantId,
    name: "Half hour",
    durationMinutes: 30,
    priceMinor: 5000,
    currency: "GBP",
    requestKey: `${prefix}-service-30`,
  });
  const linkedOff = {
    tenantId,
    clientId,
    serviceId,
    startsAt: at("2041-01-08T09:00:00Z"),
    requestKey: `${prefix}-linked-off`,
  };
  const linkedOffId = await alice.mutation("bookings:createLinked", linkedOff);
  await alice.mutation("bookings:reschedule", {
    tenantId,
    bookingId: linkedOffId,
    startsAt: at("2041-01-09T09:00:00Z"),
    expectedRevision: 0,
  });
  const legacyOff = {
    tenantId,
    practitionerId: "practice",
    startsAt: at("2041-01-08T12:00:00Z"),
    endsAt: at("2041-01-08T13:00:00Z"),
    clientLabel: "Legacy outside hours",
    requestKey: `${prefix}-legacy-off`,
  };
  const legacyOffId = await alice.mutation("bookings:create", legacyOff);
  const enquiryId = await alice.mutation("enquiries:create", {
    tenantId,
    name: "Off-hours enquiry",
    subject: "Book outside hours",
    message: "Manual scheduling remains available while enforcement is off.",
    requestKey: `${prefix}-enquiry-off`,
  });
  const conversionOff = {
    tenantId,
    enquiryId,
    expectedRevision: 0,
    requestKey: `${prefix}-conversion-off`,
    client: { create: { name: "Converted while off" } },
    booking: {
      create: {
        serviceId,
        startsAt: at("2041-01-08T15:00:00Z"),
      },
    },
  };
  const conversionOffResult = await alice.mutation(
    "enquiries:convert",
    conversionOff,
  );
  assert.ok(conversionOffResult.bookingId);
  check("enforcement off preserves legacy, linked, reschedule and enquiry conversion scheduling");

  assert.equal(
    await alice.mutation("settings:update", settings(1, londonWeek, true)),
    2,
  );
  // A pre-feature caller may omit the new field. It must preserve the current
  // opt-in rather than disable it during an unrelated save.
  assert.equal(
    await alice.mutation("settings:update", {
      tenantId,
      name: `Hours ${prefix} renamed`,
      availability: londonWeek,
      expectedRevision: 2,
      expectedTimeZone: "Europe/London",
    }),
    3,
  );
  assert.equal(
    (await alice.query("settings:get", { tenantId })).enforceBookingHours,
    true,
  );
  check("enforcement is explicit, persisted and preserved when older settings callers omit it");

  const linked = (startsAt, requestKey, selectedServiceId = serviceId) => ({
    tenantId,
    clientId,
    serviceId: selectedServiceId,
    startsAt,
    requestKey,
  });
  const allowedArgs = linked(
    at("2041-01-14T16:00:00Z"),
    `${prefix}-linked-allowed`,
  );
  const allowedId = await alice.mutation("bookings:createLinked", allowedArgs);
  await assert.rejects(
    alice.mutation(
      "bookings:createLinked",
      linked(at("2041-01-21T16:30:00Z"), `${prefix}-linked-late`),
    ),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  await assert.rejects(
    alice.mutation(
      "bookings:createLinked",
      linked(at("2041-01-15T09:00:00Z"), `${prefix}-linked-closed`),
    ),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  check("London Monday 09:00-17:00 allows a 60-minute 16:00 booking and denies 16:30 and closed Tuesday");

  const moveId = await alice.mutation(
    "bookings:createLinked",
    linked(at("2041-01-28T10:00:00Z"), `${prefix}-move`),
  );
  await alice.mutation("bookings:reschedule", {
    tenantId,
    bookingId: moveId,
    startsAt: at("2041-01-28T16:00:00Z"),
    expectedRevision: 0,
  });
  await assert.rejects(
    alice.mutation("bookings:reschedule", {
      tenantId,
      bookingId: moveId,
      startsAt: at("2041-02-04T16:30:00Z"),
      expectedRevision: 1,
    }),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  const afterDeniedMove = (
    await alice.query("bookings:list", {
      tenantId,
      from: at("2041-01-28T00:00:00Z"),
      to: at("2041-01-29T00:00:00Z"),
    })
  ).items.find(({ _id }) => _id === moveId);
  assert.equal(afterDeniedMove?.startsAt, at("2041-01-28T16:00:00Z"));
  assert.equal(afterDeniedMove?.revision, 1);
  await alice.mutation("bookings:create", {
    tenantId,
    practitionerId: "practice",
    startsAt: at("2041-02-11T16:00:00Z"),
    endsAt: at("2041-02-11T17:00:00Z"),
    clientLabel: "Legacy path allowed",
    requestKey: `${prefix}-legacy-allowed`,
  });
  await assert.rejects(
    alice.mutation("bookings:create", {
      tenantId,
      practitionerId: "practice",
      startsAt: at("2041-02-18T16:30:00Z"),
      endsAt: at("2041-02-18T17:30:00Z"),
      clientLabel: "Legacy path denied",
      requestKey: `${prefix}-legacy-denied`,
    }),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  check("reschedule and legacy create enforce the same whole-interval rule without mutating a denied reschedule");

  const atomicEnquiryId = await alice.mutation("enquiries:create", {
    tenantId,
    name: "Atomic hours enquiry",
    subject: "Closed day conversion",
    message: "No partial client or link should survive a rejected booking.",
    requestKey: `${prefix}-atomic-enquiry`,
  });
  const atomicClientName = `Atomic hours client ${prefix}`;
  const deniedConversion = {
    tenantId,
    enquiryId: atomicEnquiryId,
    expectedRevision: 0,
    requestKey: `${prefix}-atomic-conversion`,
    client: { create: { name: atomicClientName } },
    booking: {
      create: {
        serviceId,
        startsAt: at("2041-02-19T10:00:00Z"),
      },
    },
  };
  await assert.rejects(
    alice.mutation("enquiries:convert", deniedConversion),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  const afterDeniedConversion = await alice.query("enquiries:get", {
    tenantId,
    enquiryId: atomicEnquiryId,
  });
  assert.ok(!afterDeniedConversion.clientId && !afterDeniedConversion.bookingId);
  const noPartialClient = await alice.query("clients:list", {
    tenantId,
    search: atomicClientName,
    paginationOpts: { numItems: 10, cursor: null },
  });
  assert.ok(
    !noPartialClient.page.some(({ name }) => name === atomicClientName),
  );
  const allowedConversion = {
    ...deniedConversion,
    booking: {
      create: {
        serviceId,
        startsAt: at("2041-02-18T15:00:00Z"),
      },
    },
  };
  assert.ok(
    (await alice.mutation("enquiries:convert", allowedConversion)).bookingId,
  );
  check("enquiry booking conversion enforces hours atomically and a rejected conversion leaves no client or links");

  const narrowWeek = closedWeek({
    monday: { open: "09:00", close: "10:00" },
  });
  assert.equal(
    await alice.mutation("settings:update", {
      ...settings(3, narrowWeek, true),
      name: `Hours ${prefix} renamed`,
    }),
    4,
  );
  await alice.mutation("tenants:setTimeZone", {
    tenantId,
    timeZone: "America/New_York",
    expectedTimeZone: "Europe/London",
  });
  assert.equal(await alice.mutation("bookings:createLinked", allowedArgs), allowedId);
  assert.equal(await alice.mutation("bookings:create", legacyOff), legacyOffId);
  assert.equal(
    await alice.mutation("bookings:reschedule", {
      tenantId,
      bookingId: moveId,
      startsAt: at("2041-01-28T16:00:00Z"),
      expectedRevision: 1,
    }),
    moveId,
  );
  assert.deepEqual(
    await alice.mutation("enquiries:convert", conversionOff),
    conversionOffResult,
  );
  check("original linked, legacy, reschedule and conversion retries replay before changed hours or time-zone validation");

  await alice.mutation("tenants:setTimeZone", {
    tenantId,
    timeZone: "Europe/London",
    expectedTimeZone: "America/New_York",
  });
  const fallbackWeek = closedWeek({
    sunday: { open: "01:15", close: "01:45" },
  });
  assert.equal(
    await alice.mutation("settings:update", {
      ...settings(4, fallbackWeek, true),
      name: `Hours ${prefix} renamed`,
    }),
    5,
  );
  await alice.mutation(
    "bookings:createLinked",
    linked(
      at("2026-10-25T00:15:00Z"),
      `${prefix}-fallback-first-short`,
      shortServiceId,
    ),
  );
  await alice.mutation(
    "bookings:createLinked",
    linked(
      at("2026-10-25T01:15:00Z"),
      `${prefix}-fallback-second-short`,
      shortServiceId,
    ),
  );
  await assert.rejects(
    alice.mutation(
      "bookings:createLinked",
      linked(at("2026-10-25T00:30:00Z"), `${prefix}-fallback-crossing`),
    ),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  check("fall-back occurrences are individually usable but an elapsed interval crossing the repeated-hour gap is denied");

  const springWeek = closedWeek({
    sunday: { open: "01:15", close: "02:45" },
  });
  assert.equal(
    await alice.mutation("settings:update", {
      ...settings(5, springWeek, true),
      name: `Hours ${prefix} renamed`,
    }),
    6,
  );
  await assert.rejects(
    alice.mutation(
      "bookings:createLinked",
      linked(at("2026-03-29T01:00:00Z"), `${prefix}-spring-gap`),
    ),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  const springCloseWeek = closedWeek({
    sunday: { open: "00:30", close: "01:45" },
  });
  assert.equal(
    await alice.mutation("settings:update", {
      ...settings(6, springCloseWeek, true),
      name: `Hours ${prefix} renamed`,
    }),
    7,
  );
  await assert.rejects(
    alice.mutation(
      "bookings:createLinked",
      linked(at("2026-03-29T00:30:00Z"), `${prefix}-spring-close-gap`),
    ),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  const midnightWeek = closedWeek({
    monday: { open: "00:00", close: "23:59" },
  });
  assert.equal(
    await alice.mutation("settings:update", {
      ...settings(7, midnightWeek, true),
      name: `Hours ${prefix} renamed`,
    }),
    8,
  );
  await assert.rejects(
    alice.mutation(
      "bookings:createLinked",
      linked(at("2041-01-07T23:30:00Z"), `${prefix}-midnight-crossing`),
    ),
    /OUTSIDE_PRACTICE_HOURS/,
  );
  check("nonexistent saved boundaries fail closed and the single-day hours model rejects midnight crossings");

  const otherTenantId = await bob.mutation("tenants:create", {
    name: `Other hours ${prefix}`,
    requestKey: `${prefix}-other-tenant`,
  });
  const otherLegacy = await bob.mutation("bookings:create", {
    tenantId: otherTenantId,
    practitionerId: "practice",
    startsAt: at("2041-01-08T09:00:00Z"),
    endsAt: at("2041-01-08T10:00:00Z"),
    clientLabel: "Other tenant remains off",
    requestKey: `${prefix}-other-off`,
  });
  assert.ok(otherLegacy);
  await assert.rejects(
    viewer.mutation("settings:update", {
      ...settings(8, midnightWeek, false),
      name: `Hours ${prefix} renamed`,
    }),
    /FORBIDDEN/,
  );
  check("practice-hours settings remain tenant-isolated and owner-only");
}
