import assert from "node:assert/strict";
const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
export async function settingsChecks({
  alice,
  bob,
  viewer,
  anonymous,
  viewerIdentity,
  clientForOwner,
  check,
  prefix,
  record = async () => {},
}) {
  const tenantId = await alice.mutation("tenants:create", {
    name: `Settings ${prefix}`,
  });
  await record("tenants", tenantId);
  const week = (overrides = {}) => ({
    monday: { open: "09:00", close: "17:30" },
    tuesday: { open: "09:00", close: "17:00" },
    wednesday: { open: "09:00", close: "13:00" },
    thursday: { open: "09:00", close: "17:00" },
    friday: { open: "09:00", close: "17:00" },
    saturday: null,
    sunday: null,
    ...overrides,
  });
  // A tenant created before this feature has no settings fields: reads return
  // defaults (all weekdays closed, no details) and revision 0.
  const initial = await alice.query("settings:get", { tenantId });
  assert.equal(initial.name, `Settings ${prefix}`);
  for (const day of DAYS) assert.equal(initial.availability[day], null);
  assert.equal(initial.revision, 0);
  for (const field of ["tagline", "contactEmail", "contactPhone", "address"])
    assert.ok(!(field in initial), `legacy tenant unexpectedly has ${field}`);
  check("absent practice settings read as safe defaults with revision 0");
  const base = {
    tenantId,
    name: `Settings ${prefix}`,
    tagline: "",
    availability: week(),
    expectedRevision: 0,
  };
  for (const caller of [anonymous, bob]) {
    const denied = caller === anonymous ? /UNAUTHENTICATED/ : /FORBIDDEN/;
    await assert.rejects(caller.query("settings:get", { tenantId }), denied);
    await assert.rejects(caller.mutation("settings:update", base), denied);
  }
  await assert.rejects(
    bob.mutation("settings:update", {
      ...base,
      name: "Wrong tenant",
      expectedRevision: 0,
    }),
    /FORBIDDEN/,
  );
  await alice.mutation("tenants:addViewer", {
    tenantId,
    identity: viewerIdentity,
  });
  try {
    assert.equal(
      (await viewer.query("settings:get", { tenantId })).name,
      `Settings ${prefix}`,
    );
    await assert.rejects(
      viewer.mutation("settings:update", { ...base, name: "Viewer edit" }),
      /FORBIDDEN/,
    );
  } finally {
    await alice.mutation("tenants:removeViewer", {
      tenantId,
      identity: viewerIdentity,
    });
  }
  await assert.rejects(
    viewer.query("settings:get", { tenantId }),
    /FORBIDDEN/,
  );
  check(
    "practice settings reads need membership, writes need the owner; revocation applies immediately",
  );
  for (const name of [" ", "x".repeat(101), "bad\nname", "bad\u2028name"])
    await assert.rejects(
      alice.mutation("settings:update", { ...base, name, tagline: "x" }),
      /INVALID_NAME/,
    );
  for (const tagline of ["x".repeat(201), "line\nbreak"])
    await assert.rejects(
      alice.mutation("settings:update", { ...base, tagline }),
      /INVALID_TAGLINE/,
    );
  for (const contactEmail of ["missing-at", "a@b", "x".repeat(255), "a\nb"])
    await assert.rejects(
      alice.mutation("settings:update", { ...base, contactEmail }),
      /INVALID_EMAIL/,
    );
  for (const contactPhone of ["x".repeat(41), "a\nb"])
    await assert.rejects(
      alice.mutation("settings:update", { ...base, contactPhone }),
      /INVALID_PHONE/,
    );
  for (const address of ["x".repeat(501), "a\u2028b"])
    await assert.rejects(
      alice.mutation("settings:update", { ...base, address }),
      /INVALID_ADDRESS/,
    );
  for (const availability of [
    week({ monday: { open: "9:00", close: "17:00" } }),
    week({ monday: { open: "25:00", close: "17:00" } }),
    week({ monday: { open: "12:60", close: "17:00" } }),
    week({ monday: { open: "09:00", close: "09:00" } }),
    week({ monday: { open: "17:00", close: "09:00" } }),
    week({ monday: { open: " 09:00", close: "17:00" } }),
  ])
    await assert.rejects(
      alice.mutation("settings:update", { ...base, availability }),
      /INVALID_AVAILABILITY/,
    );
  check(
    "settings validation rejects malformed names, taglines, contacts, addresses and day intervals",
  );  const edited = {
    ...base,
    name: ` Updated ${prefix} `,
    tagline: "  Quiet rooms  ",
    contactEmail: " hello@example.com ",
    contactPhone: " 01234 567890 ",
    address: " 1 Seaside Road ",
    availability: week({
      wednesday: { open: "09:30", close: "13:00" },
      friday: { open: "10:00", close: "16:00" },
    }),
    expectedRevision: 0,
  };
  const first = await alice.mutation("settings:update", edited);
  assert.equal(first, 1);
  const fresh = await clientForOwner();
  const saved = await fresh.query("settings:get", { tenantId });
  assert.equal(saved.name, `Updated ${prefix}`);
  assert.equal(saved.tagline, "Quiet rooms");
  assert.equal(saved.contactEmail, "hello@example.com");
  assert.equal(saved.contactPhone, "01234 567890");
  assert.equal(saved.address, "1 Seaside Road");
  assert.deepEqual(saved.availability.monday, { open: "09:00", close: "17:30" });
  assert.deepEqual(saved.availability.wednesday, {
    open: "09:30",
    close: "13:00",
  });
  assert.equal(saved.availability.saturday, null);
  assert.equal(saved.revision, 1);
  // Repeated identical desired state (including a stale expectation) is an
  // accepted retry and never bumps the revision.
  assert.equal(
    await alice.mutation("settings:update", { ...edited, expectedRevision: 0 }),
    1,
  );
  assert.equal((await fresh.query("settings:get", { tenantId })).revision, 1);
  // A divergent edit sent with an outdated expectation conflicts.
  await assert.rejects(
    alice.mutation("settings:update", {
      ...edited,
      name: "Stale different",
      expectedRevision: 0,
    }),
    /REVISION_CONFLICT/,
  );
  check(
    "settings save normalizes and persists every field and availability day; retries no-op while stale divergent edits conflict",
  );
  const second = await alice.mutation("settings:update", {
    ...edited,
    tagline: "Renamed tagline",
    expectedRevision: 1,
  });
  assert.equal(second, 2);
  const tenants = await fresh.query("tenants:list", {});
  assert.ok(
    tenants.some((t) => t._id === tenantId && t.name === `Updated ${prefix}`),
    "renamed practice appears in practice discovery",
  );
  const results = await Promise.allSettled([
    clientForOwner().then((c) =>
      c.mutation("settings:update", {
        ...edited,
        name: "Racing A",
        expectedRevision: 2,
      }),
    ),
    clientForOwner().then((c) =>
      c.mutation("settings:update", {
        ...edited,
        name: "Racing B",
        expectedRevision: 2,
      }),
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    results.some(
      (r) => r.status === "rejected" && String(r.reason).includes("REVISION_CONFLICT"),
    ),
  );
  const clearedUpdate = await alice.mutation("settings:update", {
    tenantId,
    name: `Updated ${prefix}`,
    availability: week(),
    expectedRevision: 3,
  });
  assert.equal(clearedUpdate, 4);
  const afterClear = await fresh.query("settings:get", { tenantId });
  for (const field of ["tagline", "contactEmail", "contactPhone", "address"])
    assert.ok(!(field in afterClear), `${field} was not removed`);
  assert.equal(afterClear.revision, 4);
  check(
    "sequential settings saves progress revisions; concurrent divergent saves admit one winner; clearing optional fields persists removal",
  );
}