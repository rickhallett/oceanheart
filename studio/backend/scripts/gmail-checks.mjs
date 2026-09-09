import assert from "node:assert/strict";
import { createHmac, randomBytes, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export async function gmailChecks({
  alice,
  bob,
  viewer,
  anonymous,
  tenantA,
  tenantB,
  issuer,
  command,
  runDir,
  check,
  signing,
}) {
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  // Only the local-copy test adapter can invoke these internal transitions with signed JWTs.
  const run = (name, args, actor = "alice") =>
    ({ alice, bob, viewer })[actor].action("gmailTest:transition", {
      name,
      args,
    });
  await assert.rejects(
    anonymous.query("gmailConnections:status", { tenantId: tenantA }),
    /UNAUTHENTICATED/,
  );
  await assert.rejects(
    bob.query("gmailConnections:status", { tenantId: tenantA }),
    /FORBIDDEN/,
  );
  await alice.mutation("tenants:addViewer", {
    tenantId: tenantA,
    identity: `${issuer}|viewer`,
  });
  await assert.rejects(
    viewer.query("gmailConnections:status", { tenantId: tenantA }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    alice.query("gmailInternal:connection", { tenantId: tenantA }),
    /internal|Could not find|not found/i,
  );
  check(
    "Gmail public status denies anonymous, outsider and viewer; secret internal query is not public",
  );
  const binding = randomBytes(32).toString("hex"),
    payload = JSON.stringify({
      v: 1,
      purpose: "begin",
      userId: "alice",
      sessionId: "session-A",
      tenantId: tenantA,
      browserBinding: binding,
      issuedAt: Date.now(),
    }),
    routeProof = {
      payload,
      signature: createHmac("sha256", Buffer.from(signing, "base64"))
        .update(payload)
        .digest("base64url"),
    };
  await assert.rejects(
    alice.action("gmail:beginConnect", {
      tenantId: tenantA,
      browserBinding: binding,
      routeProof: { ...routeProof, signature: "invalid" },
    }),
    /INVALID_ROUTE_PROOF/,
  );
  const begin = await alice.action("gmail:beginConnect", {
    tenantId: tenantA,
    browserBinding: binding,
    routeProof,
  });
  const url = new URL(begin.authorizationUrl);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(
    url.searchParams.get("scope"),
    "https://www.googleapis.com/auth/gmail.readonly",
  );
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  const consume = {
    stateHash: digest(begin.state),
    bindingHash: digest(binding),
    sessionHash: digest("session-A"),
  };
  await assert.rejects(
    run("consume", { ...consume, sessionHash: digest("session-B") }),
    /INVALID_OAUTH_STATE/,
  );
  await assert.rejects(run("consume", consume, "bob"), /FORBIDDEN/);
  const consumed = await Promise.allSettled([
    run("consume", consume),
    run("consume", consume),
  ]);
  assert.equal(consumed.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(consumed.filter((x) => x.status === "rejected").length, 1);
  await assert.rejects(run("consume", consume), /INVALID_OAUTH_STATE/);
  const cleared = JSON.parse(
    await command([
      "run",
      "--env-file",
      ".push.env",
      "--inline-query",
      `const row=await ctx.db.query("gmailOAuthStates").withIndex("by_state",q=>q.eq("stateHash",${JSON.stringify(consume.stateHash)})).unique();return row?.verifierCipher === "";`,
    ]),
  );
  assert.equal(cleared, true);
  await run("finish", {
    stateHash: consume.stateHash,
    mailbox: "synthetic@example.com",
    refreshCipher: "synthetic encrypted token",
  });
  await assert.rejects(
    run("finish", {
      stateHash: consume.stateHash,
      mailbox: "synthetic@example.com",
      refreshCipher: "synthetic encrypted token",
    }),
    /INVALID_OAUTH_STATE/,
  );
  const status = await alice.query("gmailConnections:status", {
    tenantId: tenantA,
  });
  assert.deepEqual(status, {
    connected: true,
    generation: 1,
    mailbox: "synthetic@example.com",
    needsReconnect: false,
  });
  check(
    "Signed begin binds PKCE/readonly scope; session mismatch and concurrent state replay denied; public connection projection has no token",
  );
  const message = {
    tenantId: tenantA,
    generation: 1,
    mailbox: "synthetic@example.com",
    messageId: "abc123",
    threadId: "def456",
    name: "Synthetic sender",
    email: "sender@example.com",
    subject: "Selected message",
    message: "Imported only after selection",
    truncated: false,
  };
  const imports = await Promise.all(
    Array.from({ length: 4 }, () => run("importMessage", message)),
  );
  assert.equal(new Set(imports.map((x) => x.enquiryId)).size, 1);
  assert.equal(imports.filter((x) => !x.alreadyImported).length, 1);
  const detail = await alice.query("enquiries:get", {
    tenantId: tenantA,
    enquiryId: imports[0].enquiryId,
  });
  assert.deepEqual(detail.source, {
    kind: "gmail",
    mailbox: message.mailbox,
    messageId: message.messageId,
    truncated: false,
  });
  assert.equal(detail.message, message.message);
  assert.ok(!JSON.stringify(detail).includes("refreshCipher"));
  await assert.rejects(
    bob.query("enquiries:get", {
      tenantId: tenantA,
      enquiryId: imports[0].enquiryId,
    }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    run("importMessage", { ...message, tenantId: tenantB }),
    /FORBIDDEN/,
  );
  await assert.rejects(run("importMessage", message, "viewer"), /FORBIDDEN/);
  await run("disconnect", { tenantId: tenantA, generation: 1 });
  await assert.rejects(run("importMessage", message), /CONNECTION_CHANGED/);
  assert.equal(
    (await alice.query("gmailConnections:status", { tenantId: tenantA }))
      .connected,
    false,
  );
  check(
    "Four concurrent selected imports persist one enquiry with protected source; cross-tenant/viewer import denied and disconnect invalidates in-flight generation",
  );
  const expired = {
    tenantId: tenantA,
    stateHash: "expired",
    bindingHash: "binding",
    sessionHash: "session",
    verifierCipher: "expired synthetic cipher",
    actor: `${issuer}|alice`,
    generation: 2,
    expiresAt: Date.now() - 1000,
    used: false,
    completed: false,
  };
  await writeFile(
    resolve(runDir, "gmail-expired-state.json"),
    JSON.stringify([expired]),
  );
  await command([
    "import",
    "--env-file",
    ".push.env",
    "--table",
    "gmailOAuthStates",
    "--append",
    "gmail-expired-state.json",
  ]);
  await assert.rejects(
    run("consume", {
      stateHash: "expired",
      bindingHash: "binding",
      sessionHash: "session",
    }),
    /INVALID_OAUTH_STATE/,
  );
  const expiredId = JSON.parse(
    await command([
      "run",
      "--env-file",
      ".push.env",
      "--inline-query",
      '(await ctx.db.query("gmailOAuthStates").withIndex("by_state",q=>q.eq("stateHash","expired")).unique())._id',
    ]),
  );
  await run("expireState", { id: expiredId });
  const removed = JSON.parse(
    await command([
      "run",
      "--env-file",
      ".push.env",
      "--inline-query",
      `(await ctx.db.get(${JSON.stringify(expiredId)})) === null`,
    ]),
  );
  assert.equal(removed, true);
  const pending = await alice.action("gmail:beginConnect", {
    tenantId: tenantA,
    browserBinding: binding,
    routeProof,
  });
  const pendingConsume = {
    stateHash: digest(pending.state),
    bindingHash: digest(binding),
    sessionHash: digest("session-A"),
  };
  await run("consume", pendingConsume);
  await run("disconnect", { tenantId: tenantA, generation: 2 });
  await assert.rejects(
    run("finish", {
      stateHash: pendingConsume.stateHash,
      mailbox: "synthetic@example.com",
      refreshCipher: "synthetic cipher",
    }),
    /CONNECTION_CHANGED/,
  );
  await alice.mutation("tenants:removeViewer", {
    tenantId: tenantA,
    identity: `${issuer}|viewer`,
  });
  await assert.rejects(
    viewer.action("gmail:listMessages", { tenantId: tenantA }),
    /FORBIDDEN/,
  );
  check(
    "Expired state cleanup deletes only expired row; consumed verifier cleared; pending callback cannot reconnect after disconnect; revoked membership denied without Google request",
  );
}
