import assert from "node:assert/strict";
export async function approvedActionChecks({
  alice,
  bob,
  viewer,
  anonymous,
  viewerIdentity,
  check,
  alter,
}) {
  const tenantId = await alice.mutation("tenants:create", {
    name: "Synthetic approved tasks",
  });
  await alice.mutation("tenants:addViewer", {
    tenantId,
    identity: viewerIdentity,
  });
  const fields = {
    title: "Synthetic task guide",
    provenance: "Fixture",
    format: "text",
    content: "Cancellation notice is 24 hours before an appointment.",
  };
  const sourceId = await alice.mutation("sourceLibrary:create", {
    tenantId,
    ...fields,
    requestKey: "proposal-source",
  });
  let source = await alice.query("sourceLibrary:get", { tenantId, sourceId });
  const versionId = source.version._id;
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId,
    expectedRevision: 0,
    action: "approve",
  });
  const found = await alice.query("citedAnswers:search", {
    tenantId,
    sourceIds: [sourceId],
    question: "Cancellation notice?",
  });
  const base = {
    tenantId,
    task: {
      title: "  Review synthetic cancellation guidance  ",
      dueDate: "2041-01-12",
    },
    references: found.references,
    citations: found.passages.map(({ text, ...p }) => p),
  };
  const prepare = (key, patch = {}) =>
    alice.mutation("approvedActions:prepare", {
      ...base,
      ...patch,
      requestKey: key,
    });
  const count = async () =>
    (await alice.query("tasks:list", { tenantId })).items.length;
  const id = await prepare("proposal-one");
  assert.equal(await prepare("proposal-one"), id);
  assert.equal(await count(), 0);
  const details = await alice.query("approvedActions:get", {
    tenantId,
    proposalId: id,
  });
  assert.equal(details.task.title, base.task.title.trim());
  assert.equal(details.task.dueDate, "2041-01-12");
  assert.equal(details.status, "pending");
  await assert.rejects(
    prepare("proposal-one", { task: { title: "Different" } }),
    /IDEMPOTENCY_MISMATCH/,
  );
  check(
    "immutable normalized proposal is retryable and has no task effect before approval",
  );
  for (const denied of [bob, viewer, anonymous])
    for (const [kind, fn, args] of [
      ["query", "get", { tenantId, proposalId: id }],
      ["mutation", "prepare", { ...base, requestKey: "denied" }],
      ["mutation", "approve", { tenantId, proposalId: id }],
      ["mutation", "reject", { tenantId, proposalId: id }],
    ])
      await assert.rejects(
        denied[kind]("approvedActions:" + fn, args),
        /FORBIDDEN|UNAUTHENTICATED/,
      );
  const foreignTenant = await bob.mutation("tenants:create", {
    name: "Foreign proposal tenant",
  });
  await assert.rejects(
    bob.mutation("approvedActions:approve", {
      tenantId: foreignTenant,
      proposalId: id,
    }),
    /FORBIDDEN/,
  );
  await alter({ tenantId, makeSecondOwner: true });
  await assert.rejects(
    bob.query("approvedActions:get", { tenantId, proposalId: id }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    bob.mutation("approvedActions:approve", { tenantId, proposalId: id }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    bob.mutation("approvedActions:reject", { tenantId, proposalId: id }),
    /FORBIDDEN/,
  );
  const approvals = await Promise.all(
    [1, 2].map(() =>
      alice.mutation("approvedActions:approve", { tenantId, proposalId: id }),
    ),
  );
  assert.equal(approvals[0], approvals[1]);
  assert.equal(await count(), 1);
  const taskId = approvals[0];
  assert.equal(
    (await alice.query("approvedActions:get", { tenantId, proposalId: id }))
      .taskId,
    taskId,
  );
  check(
    "owner/actor/tenant gate protects all commands; concurrent approval creates one task and durable receipt",
  );
  const rejected = await prepare("reject"),
    expired = await prepare("expire"),
    stale = await prepare("stale");
  await alice.mutation("approvedActions:reject", {
    tenantId,
    proposalId: rejected,
  });
  await alice.mutation("approvedActions:reject", {
    tenantId,
    proposalId: rejected,
  });
  await assert.rejects(
    alice.mutation("approvedActions:approve", {
      tenantId,
      proposalId: rejected,
    }),
    /PROPOSAL_REJECTED/,
  );
  await alter({ proposalId: expired, expiresAt: 0 });
  await assert.rejects(
    alice.mutation("approvedActions:approve", {
      tenantId,
      proposalId: expired,
    }),
    /PROPOSAL_EXPIRED/,
  );
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId,
    expectedRevision: 1,
    action: "revoke",
  });
  await assert.rejects(
    alice.mutation("approvedActions:approve", { tenantId, proposalId: stale }),
    /SOURCE_UNAVAILABLE/,
  );
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId,
    expectedRevision: 2,
    action: "approve",
  });
  await assert.rejects(
    alice.mutation("approvedActions:approve", { tenantId, proposalId: stale }),
    /SOURCE_UNAVAILABLE/,
  );
  assert.equal(await count(), 1);
  check(
    "rejected, expired, revoked and reapproved evidence cannot execute; no partial task writes",
  );
  await alice.mutation("tasks:remove", {
    tenantId,
    taskId,
    expectedRevision: 0,
  });
  await alter({ proposalId: id, expiresAt: 0 });
  assert.equal(
    await alice.mutation("approvedActions:approve", {
      tenantId,
      proposalId: id,
    }),
    taskId,
  );
  assert.equal(await count(), 0);
  check(
    "original receipt retry precedes expiry/evidence/task lifecycle checks without recreating removed task",
  );
  const race = await prepare("decision-race");
  const decisions = await Promise.allSettled([
    alice.mutation("approvedActions:approve", { tenantId, proposalId: race }),
    alice.mutation("approvedActions:reject", { tenantId, proposalId: race }),
  ]);
  assert.equal(decisions.filter((x) => x.status === "fulfilled").length, 1);
  const final = await alice.query("approvedActions:get", {
    tenantId,
    proposalId: race,
  });
  assert.equal(await count(), final.status === "executed" ? 1 : 0);
  const revoked = await prepare("owner-revoked");
  await alter({ tenantId, demoteOwner: true });
  await assert.rejects(
    alice.mutation("approvedActions:approve", {
      tenantId,
      proposalId: revoked,
    }),
    /FORBIDDEN/,
  );
  check(
    "approve versus reject has one terminal winner; revoked owner is denied at execution",
  );
}
