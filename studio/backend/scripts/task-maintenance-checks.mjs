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

  const dueCreate = {
    tenantId: tenantA,
    title: "Due date task",
    requestKey: "task-due-original",
    dueDate: "2026-09-15",
  };
  const dueId = await alice.mutation("tasks:create", dueCreate);
  const readDue = async () =>
    (await alice.query("tasks:list", { tenantId: tenantA })).items.find(
      (task) => task._id === dueId,
    );
  assert.equal((await readDue()).dueDate, "2026-09-15");
  for (const bad of [
    "2025-02-29",
    "1900-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "0000-01-01",
    "2026-9-5",
    "15/09/2026",
    "2026-09-15T00:00",
    "not-a-date",
  ]) {
    await assert.rejects(
      alice.mutation("tasks:create", {
        tenantId: tenantA,
        title: "Due date task",
        requestKey: `task-due-bad-${bad.replace(/[^a-z0-9]+/gi, "-")}`,
        dueDate: bad,
      }),
      /INVALID_DUE_DATE/,
    );
  }
  await assert.rejects(
    alice.mutation("tasks:update", {
      tenantId: tenantA,
      taskId: dueId,
      title: "Due date task",
      expectedRevision: (await readDue()).revision,
      dueDate: "2025-02-29",
    }),
    /INVALID_DUE_DATE/,
  );
  const leapId = await alice.mutation("tasks:create", {
    tenantId: tenantA,
    title: "Leap task",
    requestKey: "task-due-leap",
    dueDate: "2024-02-29",
  });
  assert.equal(
    (await alice.query("tasks:list", { tenantId: tenantA })).items.find(
      (task) => task._id === leapId,
    ).dueDate,
    "2024-02-29",
  );
  await alice.mutation("tasks:update", {
    tenantId: tenantA,
    taskId: leapId,
    title: "Leap task",
    expectedRevision: 0,
    dueDate: "2000-02-29",
  });
  assert.equal(
    (await alice.query("tasks:list", { tenantId: tenantA })).items.find(
      (task) => task._id === leapId,
    ).dueDate,
    "2000-02-29",
  );
  await alice.mutation("tasks:remove", {
    tenantId: tenantA,
    taskId: leapId,
    expectedRevision: 1,
  });
  let dueRevision = (await readDue()).revision;
  assert.equal(
    (await alice.mutation("tasks:update", {
      tenantId: tenantA,
      taskId: dueId,
      title: "Due date task",
      expectedRevision: dueRevision,
      dueDate: "2026-10-01",
    })).revision,
    dueRevision + 1,
  );
  assert.equal((await readDue()).dueDate, "2026-10-01");
  dueRevision = (await readDue()).revision;
  const omitted = await alice.mutation("tasks:update", {
    tenantId: tenantA,
    taskId: dueId,
    title: "Renamed due task",
    expectedRevision: dueRevision,
  });
  assert.equal(omitted.revision, dueRevision + 1);
  assert.equal((await readDue()).title, "Renamed due task");
  assert.equal((await readDue()).dueDate, "2026-10-01", "omitted dueDate preserves the existing date for legacy callers");
  dueRevision = (await readDue()).revision;
  await alice.mutation("tasks:update", {
    tenantId: tenantA,
    taskId: dueId,
    title: "Renamed due task",
    expectedRevision: dueRevision,
    dueDate: null,
  });
  assert.equal((await readDue()).dueDate, undefined);
  dueRevision = (await readDue()).revision;
  const clearedNoop = await alice.mutation("tasks:update", {
    tenantId: tenantA,
    taskId: dueId,
    title: "Renamed due task",
    expectedRevision: dueRevision,
    dueDate: null,
  });
  assert.equal(clearedNoop.revision, dueRevision, "clearing an absent date does not invent a revision");
  dueRevision = (await readDue()).revision;
  const dueContenders = await Promise.all([clientForOwner(), clientForOwner()]);
  const dueRaced = await Promise.allSettled(
    dueContenders.map((client, index) =>
      client.mutation("tasks:update", {
        tenantId: tenantA,
        taskId: dueId,
        title: "Renamed due task",
        expectedRevision: dueRevision,
        dueDate: index === 0 ? "2026-11-01" : "2026-12-01",
      }),
    ),
  );
  assert.equal(dueRaced.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(
    dueRaced.some(
      (result) =>
        result.status === "rejected" &&
        String(result.reason).includes("REVISION_CONFLICT"),
    ),
  );
  assert.equal(
    await alice.mutation("tasks:create", dueCreate),
    dueId,
    "the original dated create request remains retryable after date edits",
  );
  await assert.rejects(
    alice.mutation("tasks:create", { ...dueCreate, dueDate: "2026-10-01" }),
    /IDEMPOTENCY_MISMATCH/,
  );
  await alice.mutation("tenants:addViewer", {
    tenantId: tenantA,
    identity: viewerIdentity,
  });
  try {
    assert.ok(
      (await viewer.query("tasks:list", { tenantId: tenantA })).items.some(
        (task) => task._id === dueId,
      ),
    );
    await assert.rejects(
      viewer.mutation("tasks:create", {
        tenantId: tenantA,
        title: "Viewer due",
        requestKey: "task-due-viewer",
        dueDate: "2026-09-15",
      }),
      /FORBIDDEN/,
    );
    await assert.rejects(
      viewer.mutation("tasks:update", {
        tenantId: tenantA,
        taskId: dueId,
        title: "Viewer edit",
        expectedRevision: (await readDue()).revision,
        dueDate: "2026-09-15",
      }),
      /FORBIDDEN/,
    );
  } finally {
    await alice.mutation("tenants:removeViewer", {
      tenantId: tenantA,
      identity: viewerIdentity,
    });
  }
  await assert.rejects(
    bob.mutation("tasks:update", {
      tenantId: tenantB,
      taskId: dueId,
      title: "Wrong tenant",
      expectedRevision: 0,
      dueDate: "2026-09-15",
    }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    anonymous.mutation("tasks:create", {
      tenantId: tenantA,
      title: "Anon due",
      requestKey: "task-due-anon",
      dueDate: "2026-09-15",
    }),
    /UNAUTHENTICATED/,
  );
  dueRevision = (await readDue()).revision;
  assert.equal(
    await alice.mutation("tasks:remove", {
      tenantId: tenantA,
      taskId: dueId,
      expectedRevision: dueRevision,
    }),
    dueId,
  );
  assert.equal(
    await alice.mutation("tasks:create", dueCreate),
    dueId,
    "removal leaves the original dated create receipt in place",
  );
  await assert.rejects(
    alice.mutation("tasks:update", {
      tenantId: tenantA,
      taskId: dueId,
      title: "After removal",
      expectedRevision: dueRevision + 1,
      dueDate: "2026-09-15",
    }),
    /TASK_REMOVED/,
  );
  const datelessCreate = {
    tenantId: tenantA,
    title: "Dateless task",
    requestKey: "task-dateless-original",
  };
  const datelessId = await alice.mutation("tasks:create", datelessCreate);
  const readDateless = async () =>
    (await alice.query("tasks:list", { tenantId: tenantA })).items.find(
      (task) => task._id === datelessId,
    );
  assert.equal((await readDateless()).dueDate, undefined);
  let datelessRevision = (await readDateless()).revision;
  await alice.mutation("tasks:update", {
    tenantId: tenantA,
    taskId: datelessId,
    title: "Dateless task",
    expectedRevision: datelessRevision,
    dueDate: "2026-10-01",
  });
  assert.equal((await readDateless()).dueDate, "2026-10-01");
  assert.equal(
    await alice.mutation("tasks:create", datelessCreate),
    datelessId,
    "a date-less create stays retryable after a date is set",
  );
  await assert.rejects(
    alice.mutation("tasks:create", {
      ...datelessCreate,
      dueDate: "2026-10-01",
    }),
    /IDEMPOTENCY_MISMATCH/,
  );
  datelessRevision = (await readDateless()).revision;
  assert.equal(
    await alice.mutation("tasks:remove", {
      tenantId: tenantA,
      taskId: datelessId,
      expectedRevision: datelessRevision,
    }),
    datelessId,
  );
  assert.equal(
    await alice.mutation("tasks:create", datelessCreate),
    datelessId,
    "a date-less create stays retryable after removal",
  );
  check("task due dates accept real YYYY-MM-DD calendar days including leap years, reject impossible dates, preserve on omitted updates, clear on null, keep date-less creates retryable after dates/removal, enforce revisions and tombstone receipts with owner-only tenant isolation");
  const legacyId = await seedBoundaryTasks();  assert.equal(
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
