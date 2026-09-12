import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export async function sourceLibraryChecks({
  alice,
  bob,
  viewer,
  anonymous,
  viewerIdentity,
  corruptCurrent,
  check,
}) {
  const tenantId = await alice.mutation("tenants:create", {
    name: "Synthetic source library",
  });
  await alice.mutation("tenants:addViewer", {
    tenantId,
    identity: viewerIdentity,
  });
  const fields = {
    title: "Synthetic practice guide",
    provenance: "Fictional fixture",
    format: "markdown",
    content: "# Welcome\nFictional opening information.",
  };
  const args = { tenantId, ...fields, requestKey: "source-create" };
  const ids = await Promise.all([
    alice.mutation("sourceLibrary:create", args),
    alice.mutation("sourceLibrary:create", args),
  ]);
  assert.equal(ids[0], ids[1]);
  const sourceId = ids[0];
  let data = await alice.query("sourceLibrary:get", { tenantId, sourceId });
  assert.equal(data.source.audience, "owner");
  assert.equal(data.source.approvedVersionId, undefined);
  assert.equal(
    data.version.hash,
    createHash("sha256").update(fields.content).digest("hex"),
  );
  const original = data.version._id;
  check(
    "source create is atomic and idempotent, owner-only, unapproved and SHA256-versioned",
  );
  for (const denied of [bob, viewer, anonymous]) {
    await assert.rejects(
      denied.query("sourceLibrary:list", {
        tenantId,
        archived: false,
        paginationOpts: { numItems: 20, cursor: null },
      }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.query("sourceLibrary:get", { tenantId, sourceId }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.query("sourceLibrary:versions", {
        tenantId,
        sourceId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.query("sourceLibrary:version", {
        tenantId,
        sourceId,
        versionId: original,
      }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.mutation("sourceLibrary:create", {
        ...args,
        requestKey: "denied",
      }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.mutation("sourceLibrary:save", {
        ...fields,
        tenantId,
        sourceId,
        expectedRevision: 0,
        requestKey: "denied-save",
      }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.mutation("sourceLibrary:changeStatus", {
        tenantId,
        sourceId,
        versionId: original,
        expectedRevision: 0,
        action: "approve",
      }),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
  }
  check(
    "anonymous, viewer and outsider cannot list/read/history/create/edit/approve source material",
  );
  await alice.mutation("knowledgeAccess:grant", {
    tenantId,
    identity: viewerIdentity,
    capability: "read",
  });
  assert.equal(
    (await viewer.query("sourceLibrary:get", { tenantId, sourceId })).version._id,
    original,
  );
  await assert.rejects(viewer.mutation("sourceLibrary:save", {
    ...fields, tenantId, sourceId, expectedRevision: 0, requestKey: "reader-write",
  }), /FORBIDDEN/);
  await alice.mutation("knowledgeAccess:grant", {
    tenantId,
    identity: viewerIdentity,
    capability: "contribute",
  });
  const contributed = await viewer.mutation("sourceLibrary:create", {
    ...args, requestKey: "contributor-create",
  });
  const contributedVersion = (await viewer.query("sourceLibrary:get", {tenantId, sourceId: contributed})).version._id;
  await assert.rejects(viewer.mutation("sourceLibrary:changeStatus", {
    tenantId, sourceId: contributed, versionId: contributedVersion,
    expectedRevision: 0, action: "approve",
  }), /FORBIDDEN/);
  await alice.mutation("knowledgeAccess:revoke", { tenantId, identity: viewerIdentity });
  await assert.rejects(viewer.query("sourceLibrary:get", { tenantId, sourceId }), /FORBIDDEN/);
  await alice.mutation("sourceLibrary:changeStatus", {tenantId, sourceId: contributed, versionId: contributedVersion, expectedRevision: 0, action: "delete"});
  check("knowledge grants are tenant-scoped, capability-bounded, revocable and never confer approval");
  const uploadArgs = {
    tenantId,
    bytes: new TextEncoder().encode("Fictional massage rate and intake policy").buffer,
    title: "Fictional massage operations",
    provenance: "Synthetic upload fixture",
    format: "text",
    requestKey: "upload-text",
  };
  const uploadA = await alice.action("knowledgeIngestionActions:upload", uploadArgs);
  const uploadB = await alice.action("knowledgeIngestionActions:upload", uploadArgs);
  assert.equal(uploadA.uploadId, uploadB.uploadId);
  const uploadedSource = await alice.action("knowledgeIngestionActions:process", {tenantId, uploadId: uploadA.uploadId});
  const uploaded = await alice.query("sourceLibrary:get", {tenantId, sourceId: uploadedSource});
  await alice.mutation("sourceLibrary:changeStatus", {tenantId, sourceId: uploadedSource, versionId: uploaded.version._id, expectedRevision: 0, action: "approve"});
  const replacement = await alice.action("knowledgeIngestionActions:upload", {
    ...uploadArgs,
    bytes: new TextEncoder().encode("Updated fictional massage policy").buffer,
    requestKey: "upload-replacement",
    targetSourceId: uploadedSource,
    expectedRevision: 1,
  });
  await alice.action("knowledgeIngestionActions:process", {tenantId, uploadId: replacement.uploadId});
  const replaced = await alice.query("sourceLibrary:get", {tenantId, sourceId: uploadedSource});
  assert.equal(replaced.version.number, 2);
  assert.equal(replaced.source.approvedVersionId, undefined);
  await assert.rejects(alice.query("citedAnswers:search", {tenantId, sourceIds:[uploadedSource], question:"massage policy"}), /SOURCE_UNAVAILABLE/);
  await alice.mutation("sourceLibrary:changeStatus", {tenantId, sourceId: uploadedSource, versionId: replaced.version._id, expectedRevision: 2, action: "delete"});
  check("authenticated byte upload is idempotent; replacement versions clear approval and stale retrieval fails closed");
  const approve = {
    tenantId,
    sourceId,
    versionId: original,
    expectedRevision: 0,
    action: "approve",
  };
  assert.equal(await alice.mutation("sourceLibrary:changeStatus", approve), 1);
  assert.equal(await alice.mutation("sourceLibrary:changeStatus", approve), 1);
  const edit = {
    ...fields,
    tenantId,
    sourceId,
    expectedRevision: 1,
    content: "Updated synthetic text",
    requestKey: "save-first",
  };
  const saved = await alice.mutation("sourceLibrary:save", edit);
  assert.equal(await alice.mutation("sourceLibrary:save", edit), saved);
  data = await alice.query("sourceLibrary:get", { tenantId, sourceId });
  assert.equal(data.source.revision, 2);
  assert.equal(data.source.approvedVersionId, undefined);
  assert.equal(data.version.number, 2);
  assert.equal(
    (
      await alice.query("sourceLibrary:version", {
        tenantId,
        sourceId,
        versionId: original,
      })
    ).content,
    fields.content,
  );
  await assert.rejects(
    alice.mutation("sourceLibrary:changeStatus", approve),
    /REVISION_CONFLICT/,
  );
  await assert.rejects(
    alice.mutation("sourceLibrary:save", {
      ...edit,
      requestKey: "stale-edit",
      content: "Stale",
    }),
    /REVISION_CONFLICT/,
  );
  check(
    "edits retain immutable history, revoke approval, preserve retry receipts and reject stale writes/approvals",
  );
  const race = await Promise.allSettled(
    ["A", "B"].map((x) =>
      alice.mutation("sourceLibrary:save", {
        ...edit,
        expectedRevision: 2,
        requestKey: "race-" + x,
        content: x,
      }),
    ),
  );
  assert.equal(race.filter((x) => x.status === "fulfilled").length, 1);
  data = await alice.query("sourceLibrary:get", { tenantId, sourceId });
  assert.equal(data.source.revision, 3);
  const status = {
    tenantId,
    sourceId,
    versionId: data.version._id,
    expectedRevision: 3,
    action: "approve",
  };
  await alice.mutation("sourceLibrary:changeStatus", status);
  await alice.mutation("sourceLibrary:changeStatus", {
    ...status,
    expectedRevision: 4,
    action: "revoke",
  });
  await assert.rejects(
    alice.mutation("sourceLibrary:changeStatus", status),
    /REVISION_CONFLICT/,
  );
  await alice.mutation("sourceLibrary:changeStatus", {
    ...status,
    expectedRevision: 5,
    action: "archive",
  });
  data = await alice.query("sourceLibrary:get", { tenantId, sourceId });
  assert.equal(data.source.archived, true);
  assert.equal(data.source.approvedVersionId, undefined);
  assert.equal(
    (
      await alice.query("sourceLibrary:list", {
        tenantId,
        archived: false,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page.length,
    0,
  );
  await assert.rejects(
    alice.mutation("sourceLibrary:save", {
      ...edit,
      expectedRevision: 6,
      requestKey: "archived-write",
    }),
    /SOURCE_ARCHIVED/,
  );
  assert.equal(await alice.mutation("sourceLibrary:save", edit), saved);
  assert.equal(
    (await alice.query("sourceLibrary:get", { tenantId, sourceId })).source
      .archived,
    true,
  );
  check(
    "concurrent edits have one winner; revoke/archive disable approval and receipt replay cannot reactivate",
  );
  for (const content of ["", "x".repeat(32769), "bad\0text"])
    await assert.rejects(
      alice.mutation("sourceLibrary:create", {
        ...args,
        content,
        requestKey: "invalid-" + content.length,
      }),
      /INVALID_SOURCE_CONTENT/,
    );
  const history = await alice.query("sourceLibrary:versions", {
    tenantId,
    sourceId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  assert.equal(history.page.length, 3);
  assert.ok(history.page.every((x) => !("content" in x)));
  const other = await bob.mutation("tenants:create", {
    name: "Other source tenant",
  });
  const foreign = await bob.mutation("sourceLibrary:create", {
    ...fields,
    tenantId: other,
    requestKey: "other",
  });
  const foreignData = await bob.query("sourceLibrary:get", {
    tenantId: other,
    sourceId: foreign,
  });
  await assert.rejects(
    alice.query("sourceLibrary:version", {
      tenantId,
      sourceId,
      versionId: foreignData.version._id,
    }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    alice.query("sourceLibrary:get", { tenantId, sourceId: foreign }),
    /FORBIDDEN/,
  );
  assert.equal(
    (
      await alice.query("sourceLibrary:list", {
        tenantId,
        archived: true,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page.length,
    1,
  );
  check(
    "invalid writes leave no partial source/version; foreign IDs denied; archived index and bounded history remain scoped",
  );
  const deletedId = await alice.mutation("sourceLibrary:create", {
    ...args,
    requestKey: "delete-source",
  });
  const deleted = await alice.query("sourceLibrary:get", {tenantId, sourceId: deletedId});
  const deleteArgs = {
    tenantId,
    sourceId: deletedId,
    versionId: deleted.version._id,
    expectedRevision: 0,
    action: "delete",
  };
  assert.equal(await alice.mutation("sourceLibrary:changeStatus", deleteArgs), 1);
  assert.equal(await alice.mutation("sourceLibrary:changeStatus", deleteArgs), 1);
  assert.equal((await alice.query("sourceLibrary:versions", {
    tenantId, sourceId: deletedId, paginationOpts: {numItems: 10, cursor: null},
  })).page.length, 0);
  await assert.rejects(alice.query("sourceLibrary:get", {tenantId, sourceId: deletedId}), /INVALID_SOURCE_VERSION/);
  check("explicit delete removes version content and leaves only inaccessible source audit metadata");
  const malformedId = await alice.mutation("sourceLibrary:create", {
    ...args,
    requestKey: "malformed",
  });
  const malformed = await alice.query("sourceLibrary:get", {
    tenantId,
    sourceId: malformedId,
  });
  for (const target of [foreignData.version._id, original, undefined]) {
    await corruptCurrent(malformedId, target);
    await assert.rejects(
      alice.query("sourceLibrary:get", { tenantId, sourceId: malformedId }),
      /INVALID_SOURCE_VERSION/,
    );
    await assert.rejects(
      alice.mutation("sourceLibrary:save", {
        ...fields,
        tenantId,
        sourceId: malformedId,
        expectedRevision: 0,
        requestKey: "malformed-save",
      }),
      /INVALID_SOURCE_VERSION/,
    );
    await assert.rejects(
      alice.mutation("sourceLibrary:changeStatus", {
        tenantId,
        sourceId: malformedId,
        versionId: target ?? malformed.version._id,
        expectedRevision: 0,
        action: "approve",
      }),
      /INVALID_SOURCE_VERSION/,
    );
  }
  await corruptCurrent(malformedId, malformed.version._id);
  assert.equal(
    (
      await alice.query("sourceLibrary:get", {
        tenantId,
        sourceId: malformedId,
      })
    ).source.revision,
    0,
  );
  assert.equal(
    (
      await alice.query("sourceLibrary:versions", {
        tenantId,
        sourceId: malformedId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page.length,
    1,
  );
  check(
    "malformed foreign-tenant, wrong-source and absent current pointers fail closed for get/save/approval without writes",
  );
}
