import assert from "node:assert/strict";

export async function taskMaintenanceChecks({
  alice,
  bob,
  viewer,
  anonymous,
  tenantA,
  tenantB,
  viewerIdentity,
  clientForOwner,
  check,
  seedBoundaryTasks,
}) {
  const create = {
    tenantId: tenantA,
    title: "Original task title",
    requestKey: "task-maintenance-original",
  };
  const id = await alice.mutation("tasks:create", create);
  const read = async () =>
    (await alice.query("tasks:list", { tenantId: tenantA })).items.find(
      (task) => task._id === id,
    );

  // The former completion command remains valid without expectedRevision, and
  // still advances the revision so newer clients see the remote change.
  await alice.mutation("tasks:setCompleted", {
    tenantId: tenantA,
    taskId: id,
    completed: true,
  });
  assert.equal((await read()).revision, 1);
  await alice.mutation("tasks:setCompleted", {
    tenantId: tenantA,
    taskId: id,
    completed: false,
    expectedRevision: 1,
  });
  assert.equal((await read()).revision, 2);

  const current = await read();
  const contenders = await Promise.all([clientForOwner(), clientForOwner()]);
  const raced = await Promise.allSettled(
    contenders.map((client, index) =>
      client.mutation("tasks:update", {
        tenantId: tenantA,
        taskId: id,
        title: `Concurrent task title ${index}`,
        expectedRevision: current.revision,
      }),
    ),
  );
  assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(
    raced.some(
      (result) =>
        result.status === "rejected" &&
        String(result.reason).includes("REVISION_CONFLICT"),
    ),
  );
  const edited = await read();
  const unchanged = await alice.mutation("tasks:update", {
      tenantId: tenantA,
      taskId: id,
      title: edited.title,
      expectedRevision: current.revision,
    });
  assert.equal(unchanged.taskId, id, "same desired title is a safe retry after a lost acknowledgement");
  assert.equal(unchanged.revision, edited.revision, "an unchanged title does not invent a revision");
  const trimmed = await alice.mutation("tasks:update", {
    tenantId: tenantA,
    taskId: id,
    title: ` ${edited.title} `,
    expectedRevision: current.revision,
  });
  assert.equal(trimmed.revision, edited.revision, "a normalized unchanged title keeps the acknowledged revision");
  assert.equal(
    await alice.mutation("tasks:create", create),
    id,
    "the original create request remains retryable after a rename",
  );

  const latest = await read();
  for (const caller of [anonymous, bob]) {
    const denied = caller === anonymous ? /UNAUTHENTICATED/ : /FORBIDDEN/;
    await assert.rejects(
      caller.mutation("tasks:update", {
        tenantId: tenantA,
        taskId: id,
        title: "Denied edit",
        expectedRevision: latest.revision,
      }),
      denied,
    );
    await assert.rejects(
      caller.mutation("tasks:remove", {
        tenantId: tenantA,
        taskId: id,
        expectedRevision: latest.revision,
      }),
      denied,
    );
  }
  await assert.rejects(
    bob.mutation("tasks:update", {
      tenantId: tenantB,
      taskId: id,
      title: "Wrong tenant",
      expectedRevision: latest.revision,
    }),
    /FORBIDDEN/,
  );
  await alice.mutation("tenants:addViewer", {
    tenantId: tenantA,
    identity: viewerIdentity,
  });
  try {
    assert.ok((await viewer.query("tasks:list", { tenantId: tenantA })).items.some((task) => task._id === id));
    for (const command of ["tasks:setCompleted", "tasks:update", "tasks:remove"]) {
      const args =
        command === "tasks:setCompleted"
          ? { tenantId: tenantA, taskId: id, completed: true, expectedRevision: latest.revision }
          : command === "tasks:update"
            ? { tenantId: tenantA, taskId: id, title: "Viewer edit", expectedRevision: latest.revision }
            : { tenantId: tenantA, taskId: id, expectedRevision: latest.revision };
      await assert.rejects(viewer.mutation(command, args), /FORBIDDEN/);
    }
  } finally {
    await alice.mutation("tenants:removeViewer", {
      tenantId: tenantA,
      identity: viewerIdentity,
    });
  }
  await assert.rejects(
    viewer.mutation("tasks:update", {
      tenantId: tenantA,
      taskId: id,
      title: "Revoked edit",
      expectedRevision: latest.revision,
    }),
    /FORBIDDEN/,
  );

  assert.equal(
    await alice.mutation("tasks:remove", {
      tenantId: tenantA,
      taskId: id,
      expectedRevision: latest.revision,
    }),
    id,
  );
  assert.equal(
    await alice.mutation("tasks:create", create),
    id,
    "removal leaves the original create receipt in place",
  );
  assert.ok(
    !(await alice.query("tasks:list", { tenantId: tenantA })).items.some(
      (task) => task._id === id,
    ),
  );
  await assert.rejects(
    alice.mutation("tasks:setCompleted", {
      tenantId: tenantA,
      taskId: id,
      completed: true,
      expectedRevision: latest.revision + 1,
    }),
    /TASK_REMOVED/,
  );

  const legacyId = await seedBoundaryTasks();
  assert.equal(
    (await alice.mutation("tasks:update", {
      tenantId: tenantA,
      taskId: legacyId,
      title: "Updated legacy task",
      expectedRevision: 0,
    })).taskId,
    legacyId,
  );
  assert.equal(
    await alice.mutation("tasks:create", {
      tenantId: tenantA,
      title: "Legacy task",
      requestKey: "legacy-task",
    }),
    legacyId,
    "legacy revision-zero records capture their original create title on edit",
  );
  for (const [filter, completed] of [
    ["all", undefined],
    ["open", false],
    ["completed", true],
  ]) {
    const result = await alice.query("tasks:list", { tenantId: tenantA, filter });
    assert.equal(result.items.length, 200, `${filter} list caps results at 200`);
    assert.equal(result.hasMore, true, `${filter} list signals more than 200`);
    if (completed !== undefined)
      assert.ok(result.items.every((task) => task.completed === completed));
  }
  check("task revisions protect concurrent edit/complete/remove; legacy completion stays compatible; owner-only writes, tombstone retry receipts and server-side 200-row filters hold");
}
