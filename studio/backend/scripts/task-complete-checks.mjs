import assert from "node:assert/strict";
export async function taskCompleteChecks({
  alice,
  bob,
  viewer,
  anonymous,
  viewerIdentity,
  check,
  alter,
}) {
  const tenantId = await alice.mutation("tenants:create", {
    name: "Synthetic completion practice",
  });
  await alice.mutation("tenants:addViewer", {
    tenantId,
    identity: viewerIdentity,
  });
  const create = (key) =>
    alice.mutation("tasks:create", {
      tenantId,
      title: `Synthetic ${key}`,
      requestKey: key,
    });
  const read = async (id) =>
    (await alice.query("tasks:list", { tenantId })).items.find(
      (t) => t._id === id,
    );
  const prepare = (taskId, key, expectedRevision = 0) =>
    alice.mutation("approvedActions:prepareCompletion", {
      tenantId,
      taskId,
      expectedRevision,
      requestKey: key,
    });
  const approve = (proposalId) =>
    alice.mutation("approvedActions:approve", { tenantId, proposalId });
  const taskId = await create("complete-one"),
    proposalId = await prepare(taskId, "p1");
  assert.equal(await prepare(taskId, "p1"), proposalId);
  assert.equal((await read(taskId)).completed, false);
  const review = await alice.query("approvedActions:get", {
    tenantId,
    proposalId,
  });
  assert.deepEqual(review.target, { taskId, revision: 0 });
  assert.equal(review.task.title, "Synthetic complete-one");
  assert.equal(review.action, "task.complete");
  await assert.rejects(prepare(taskId, "p1", 1), /IDEMPOTENCY_MISMATCH/);
  for (const denied of [bob, viewer, anonymous]) {
    await assert.rejects(
      denied.mutation("approvedActions:prepareCompletion", {
        tenantId,
        taskId,
        expectedRevision: 0,
        requestKey: "denied",
      }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.mutation("approvedActions:approve", { tenantId, proposalId }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
  }
  const foreign = await bob.mutation("tenants:create", {
    name: "Foreign completion practice",
  });
  const foreignTask = await bob.mutation("tasks:create", {
    tenantId: foreign,
    title: "Foreign",
    requestKey: "foreign",
  });
  await assert.rejects(prepare(foreignTask, "foreign"), /FORBIDDEN/);
  await alter({ tenantId, makeSecondOwner: true });
  await assert.rejects(
    bob.mutation("approvedActions:approve", { tenantId, proposalId }),
    /FORBIDDEN/,
  );
  const results = await Promise.all([approve(proposalId), approve(proposalId)]);
  assert.deepEqual(results, [taskId, taskId]);
  assert.equal((await read(taskId)).revision, 1);
  assert.equal((await read(taskId)).completed, true);
  check(
    "completion exact payload, tenant/actor permissions and concurrent single revision/receipt",
  );
  await alice.mutation("tasks:setCompleted", {
    tenantId,
    taskId,
    completed: false,
    expectedRevision: 1,
  });
  await alter({ proposalId, expiresAt: 0 });
  assert.equal(await approve(proposalId), taskId);
  assert.equal((await read(taskId)).completed, false);
  assert.equal((await read(taskId)).revision, 2);
  assert.equal(await prepare(taskId, "p1"), proposalId);
  check(
    "original completion receipt replays after reopen and expiry without completing again",
  );
  for (const change of [
    "rename",
    "complete",
    "reopen",
    "remove",
    "reject",
    "expire",
  ]) {
    const id = await create(change),
      p = await prepare(id, `p-${change}`);
    if (change === "rename")
      await alice.mutation("tasks:update", {
        tenantId,
        taskId: id,
        title: "Changed",
        expectedRevision: 0,
      });
    if (change === "complete" || change === "reopen")
      await alice.mutation("tasks:setCompleted", {
        tenantId,
        taskId: id,
        completed: true,
        expectedRevision: 0,
      });
    if (change === "reopen")
      await alice.mutation("tasks:setCompleted", {
        tenantId,
        taskId: id,
        completed: false,
        expectedRevision: 1,
      });
    if (change === "remove")
      await alice.mutation("tasks:remove", {
        tenantId,
        taskId: id,
        expectedRevision: 0,
      });
    if (change === "reject")
      await alice.mutation("approvedActions:reject", {
        tenantId,
        proposalId: p,
      });
    if (change === "expire") await alter({ proposalId: p, expiresAt: 0 });
    const before = await read(id);
    await assert.rejects(
      approve(p),
      /TASK_CHANGED|PROPOSAL_REJECTED|PROPOSAL_EXPIRED/,
    );
    assert.deepEqual(await read(id), before);
    assert.equal(
      (await alice.query("approvedActions:get", { tenantId, proposalId: p }))
        .taskId,
      null,
    );
  }
  check(
    "renamed/completed/reopened/removed/rejected/expired proposals cannot record completion",
  );
  const raceId = await create("race"),
    race = await prepare(raceId, "race");
  const decisions = await Promise.allSettled([
    approve(race),
    alice.mutation("approvedActions:reject", { tenantId, proposalId: race }),
  ]);
  assert.equal(decisions.filter((d) => d.status === "fulfilled").length, 1);
  const final = await alice.query("approvedActions:get", {
    tenantId,
    proposalId: race,
  });
  assert.equal((await read(raceId)).completed, final.status === "executed");
  const revokedId = await create("revoked"),
    revoked = await prepare(revokedId, "revoked");
  await alter({ tenantId, demoteOwner: true });
  await assert.rejects(approve(revoked), /FORBIDDEN/);
  check("approve/reject is atomic and revoked owner cannot execute");
}
