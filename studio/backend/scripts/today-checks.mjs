import assert from "node:assert/strict";

export async function todayChecks({
  alice,
  bob,
  viewer,
  anonymous,
  viewerIdentity,
  check,
  seedRows,
}) {
  const tenantA = await alice.mutation("tenants:create", {
    name: "Today Practice A",
    requestKey: "today-practice-a",
  });
  const tenantB = await bob.mutation("tenants:create", {
    name: "Today Practice B",
    requestKey: "today-practice-b",
  });
  assert.deepEqual(await alice.query("tasks:today", { tenantId: tenantA, refreshKey: 0 }), {
    status: "setup_required",
  });
  assert.deepEqual(await alice.query("bookings:today", { tenantId: tenantA, refreshKey: 0 }), {
    status: "setup_required",
  });
  await alice.mutation("tenants:setTimeZone", {
    tenantId: tenantA,
    timeZone: "Europe/London",
    expectedTimeZone: null,
  });
  await bob.mutation("tenants:setTimeZone", {
    tenantId: tenantB,
    timeZone: "Europe/London",
    expectedTimeZone: null,
  });

  const initial = await alice.query("tasks:today", {
    tenantId: tenantA,
    refreshKey: 0,
  });
  assert.equal(initial.status, "ready");
  assert.equal(initial.timeZone, "Europe/London");
  assert.ok(initial.from < Date.now() && initial.to > Date.now());

  const clientId = await alice.mutation("clients:create", {
    tenantId: tenantA,
    name: "Today Client",
    requestKey: "today-client",
  });
  const openId = await alice.mutation("tasks:create", {
    tenantId: tenantA,
    title: "Today open linked",
    dueDate: initial.day,
    clientId,
    requestKey: "today-open-linked",
  });
  const completedId = await alice.mutation("tasks:create", {
    tenantId: tenantA,
    title: "Today completed",
    dueDate: initial.day,
    requestKey: "today-completed",
  });
  await alice.mutation("tasks:setCompleted", {
    tenantId: tenantA,
    taskId: completedId,
    completed: true,
    expectedRevision: 0,
  });
  await seedRows({
    tenantA,
    tenantB,
    day: initial.day,
    from: initial.from,
    to: initial.to,
  });

  const ownerTasks = await alice.query("tasks:today", {
    tenantId: tenantA,
    refreshKey: 1,
  });
  assert.equal(ownerTasks.status, "ready");
  assert.deepEqual(new Set(ownerTasks.items.map((task) => task._id)), new Set([openId, completedId]));
  assert.equal(ownerTasks.hasMore, false);
  assert.equal(ownerTasks.items.find((task) => task._id === openId).clientName, "Today Client");
  assert.equal(ownerTasks.items.find((task) => task._id === completedId).completed, true);
  const repeated = await alice.query("tasks:today", {
    tenantId: tenantA,
    refreshKey: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(repeated.day, ownerTasks.day, "caller refresh keys cannot choose the displayed day");
  assert.deepEqual(repeated.items, ownerTasks.items);
  await assert.rejects(
    alice.query("tasks:today", {
      tenantId: tenantA,
      refreshKey: 2,
      day: "1999-01-01",
    }),
  );

  const cappedTasks = await bob.query("tasks:today", {
    tenantId: tenantB,
    refreshKey: 0,
  });
  assert.equal(cappedTasks.status, "ready");
  assert.equal(cappedTasks.items.length, 200);
  assert.equal(cappedTasks.hasMore, true);
  assert.equal(cappedTasks.limit, 200);

  const ownerBookings = await alice.query("bookings:today", {
    tenantId: tenantA,
    refreshKey: 1,
  });
  assert.equal(ownerBookings.status, "ready");
  assert.deepEqual(
    new Set(ownerBookings.items.map((booking) => booking.clientLabel)),
    new Set(["Prior overnight", "Exact start", "Legacy scheduled"]),
  );
  assert.ok(ownerBookings.items.every((booking) => booking.status === "scheduled"));
  const ordinaryList = await alice.query("bookings:list", {
    tenantId: tenantA,
    from: initial.from,
    to: initial.to,
  });
  assert.ok(
    ordinaryList.items.some((booking) => booking.clientLabel === "Cancelled today"),
    "the existing agenda command retains its cancelled-row semantics",
  );
  await assert.rejects(
    alice.query("bookings:today", {
      tenantId: tenantA,
      refreshKey: 2,
      from: 0,
      to: 1,
    }),
  );
  const cappedBookings = await bob.query("bookings:today", {
    tenantId: tenantB,
    refreshKey: 0,
  });
  assert.equal(cappedBookings.status, "ready");
  assert.equal(cappedBookings.items.length, 200);
  assert.equal(cappedBookings.hasMore, true);
  assert.equal(cappedBookings.limit, 200);

  await assert.rejects(
    anonymous.query("tasks:today", { tenantId: tenantA, refreshKey: 0 }),
    /UNAUTHENTICATED/,
  );
  await assert.rejects(
    bob.query("tasks:today", { tenantId: tenantA, refreshKey: 0 }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    bob.query("bookings:today", { tenantId: tenantA, refreshKey: 0 }),
    /FORBIDDEN/,
  );
  await alice.mutation("tenants:addViewer", {
    tenantId: tenantA,
    identity: viewerIdentity,
  });
  try {
    const viewerTasks = await viewer.query("tasks:today", {
      tenantId: tenantA,
      refreshKey: 0,
    });
    assert.equal(viewerTasks.status, "ready");
    assert.deepEqual(
      new Set(viewerTasks.items.map((task) => task._id)),
      new Set([openId, completedId]),
    );
    assert.ok(viewerTasks.items.every((task) => !("clientId" in task)));
    assert.ok(viewerTasks.items.every((task) => !("clientName" in task)));
    assert.ok(viewerTasks.items.every((task) => !("clientArchived" in task)));
    await assert.rejects(
      viewer.query("bookings:today", { tenantId: tenantA, refreshKey: 0 }),
      /FORBIDDEN/,
    );
  } finally {
    await alice.mutation("tenants:removeViewer", {
      tenantId: tenantA,
      identity: viewerIdentity,
    });
  }

  check("Today derives its date and half-open window from server time plus the stored practice zone; unset zone fails closed; newer future tasks cannot crowd out due work");
  check("Today includes open/completed tasks and scheduled overlapping bookings with bounded results; tenant, owner-booking and viewer-redaction permissions hold");
}
