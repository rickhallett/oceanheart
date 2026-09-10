import assert from "node:assert/strict";
export async function citedAnswerChecks({
  alice,
  bob,
  viewer,
  anonymous,
  viewerIdentity,
  check,
}) {
  const tenantId = await alice.mutation("tenants:create", {
    name: "Synthetic cited answers",
  });
  await alice.mutation("tenants:addViewer", {
    tenantId,
    identity: viewerIdentity,
  });
  const fields = {
    title: "Synthetic cancellation guide",
    provenance: "Held-out fiction",
    format: "text",
    content:
      "🌊 Fictional guide\nCancellation notice is 24 hours before an appointment.",
  };
  const sourceId = await alice.mutation("sourceLibrary:create", {
    tenantId,
    ...fields,
    requestKey: "answer-source",
  });
  const args = {
    tenantId,
    sourceIds: [sourceId],
    question: "What is the cancellation notice?",
  };
  await assert.rejects(
    alice.query("citedAnswers:search", args),
    /SOURCE_UNAVAILABLE/,
  );
  let data = await alice.query("sourceLibrary:get", { tenantId, sourceId });
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId: data.version._id,
    expectedRevision: 0,
    action: "approve",
  });
  const found = await alice.query("citedAnswers:search", args);
  assert.equal(found.passages.length, 1);
  const citations = found.passages.map(({ text, ...p }) => p),
    resolve = { tenantId, references: found.references, citations };
  const resolved = await alice.query("citedAnswers:resolve", resolve);
  assert.equal(
    resolved[0].text,
    "Cancellation notice is 24 hours before an appointment.",
  );
  assert.equal(resolved[0].number, 1);
  check(
    "approved owner selection retrieves exact version/hash/UTF16 span; unapproved denied",
  );
  for (const denied of [bob, viewer, anonymous]) {
    await assert.rejects(
      denied.query("citedAnswers:search", args),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.query("citedAnswers:resolve", resolve),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
    await assert.rejects(
      denied.action("citedAnswers:ask", args),
      /FORBIDDEN|UNAUTHENTICATED/,
    );
  }
  const foreignTenant = await bob.mutation("tenants:create", {
    name: "Foreign synthetic",
  });
  await assert.rejects(
    bob.query("citedAnswers:search", { ...args, tenantId: foreignTenant }),
    /FORBIDDEN/,
  );
  assert.deepEqual(
    await alice.query("citedAnswers:availability", { tenantId }),
    { enabled: false },
  );
  await assert.rejects(
    alice.action("citedAnswers:ask", args),
    /PROVIDER_NOT_CONFIGURED/,
  );
  check(
    "owner/tenant boundary protects search, citations and action before external work; provider default OFF",
  );
  for (const patch of [
    { start: -1 },
    { end: 99999 },
    { start: 1.5 },
    { hash: "tampered" },
  ])
    await assert.rejects(
      alice.query("citedAnswers:resolve", {
        ...resolve,
        citations: [{ ...citations[0], ...patch }],
      }),
      /INVALID_CITATION/,
    );
  await assert.rejects(
    alice.query("citedAnswers:search", {
      ...args,
      sourceIds: [sourceId, sourceId],
    }),
    /INVALID_SELECTION/,
  );
  assert.equal(
    (
      await alice.query("citedAnswers:search", {
        ...args,
        question: "Do you offer acupuncture?",
      })
    ).passages.length,
    0,
  );
  check(
    "tampered spans/hash and duplicate selection rejected; absent lexical question yields no evidence",
  );
  await alice.mutation("sourceLibrary:save", {
    tenantId,
    sourceId,
    ...fields,
    content: "Cancellation notice is 48 hours before an appointment.",
    expectedRevision: 1,
    requestKey: "answer-edit",
  });
  await assert.rejects(
    alice.query("citedAnswers:resolve", resolve),
    /SOURCE_UNAVAILABLE/,
  );
  data = await alice.query("sourceLibrary:get", { tenantId, sourceId });
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId: data.version._id,
    expectedRevision: 2,
    action: "approve",
  });
  await assert.rejects(
    alice.query("citedAnswers:resolve", resolve),
    /SOURCE_UNAVAILABLE/,
  );
  const current = await alice.query("citedAnswers:search", args);
  const currentResolve = {
    tenantId,
    references: current.references,
    citations: current.passages.map(({ text, ...p }) => p),
  };
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId: data.version._id,
    expectedRevision: 3,
    action: "revoke",
  });
  await assert.rejects(
    alice.query("citedAnswers:resolve", currentResolve),
    /SOURCE_UNAVAILABLE/,
  );
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId: data.version._id,
    expectedRevision: 4,
    action: "approve",
  });
  await alice.mutation("sourceLibrary:changeStatus", {
    tenantId,
    sourceId,
    versionId: data.version._id,
    expectedRevision: 5,
    action: "archive",
  });
  await assert.rejects(
    alice.query("citedAnswers:resolve", currentResolve),
    /SOURCE_UNAVAILABLE/,
  );
  check(
    "edit/reapproval never legitimizes old citation; revoke and archive invalidate current citation",
  );
}
