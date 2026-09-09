import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import {
  encrypt,
  decrypt,
  routeProof,
  digest,
} from "../convex/lib/gmailSecurity.ts";
import { messagePreview, sender } from "../convex/lib/gmailMessage.ts";
import { googleRequest } from "../convex/lib/gmailProvider.ts";
test("refresh encryption binds tenant/mailbox and authenticates ciphertext", () => {
  const key = randomBytes(32),
    cipher = encrypt("private refresh token", "tenantA:mailbox", key);
  assert.ok(!cipher.includes("private"));
  assert.equal(
    decrypt(cipher, "tenantA:mailbox", key),
    "private refresh token",
  );
  assert.throws(() => decrypt(cipher, "tenantB:mailbox", key));
  assert.throws(() => decrypt(cipher, "tenantA:mailbox", randomBytes(32)));
  assert.notEqual(
    cipher,
    encrypt("private refresh token", "tenantA:mailbox", key),
  );
});
test("route proof binds actor, command, state, code, browser binding and expiry", () => {
  const key = randomBytes(32),
    now = Date.now(),
    payload = JSON.stringify({
      v: 1,
      purpose: "complete",
      userId: "alice",
      state: "state",
      browserBinding: "binding",
      codeHash: digest("code"),
      sessionId: "session",
      issuedAt: now,
    }),
    proof = {
      payload,
      signature: createHmac("sha256", key).update(payload).digest("base64url"),
    },
    expected = {
      purpose: "complete",
      userId: "alice",
      state: "state",
      browserBinding: "binding",
      codeHash: digest("code"),
    };
  assert.equal(routeProof(proof, key, expected, now).sessionId, "session");
  for (const field of Object.keys(expected))
    assert.throws(() =>
      routeProof(proof, key, { ...expected, [field]: "different" }, now),
    );
  assert.throws(() => routeProof(proof, key, expected, now + 120001));
  assert.throws(() => routeProof(proof, key, expected, now - 30001));
  assert.throws(() =>
    routeProof(
      { ...proof, payload: payload.replace("alice", "bob") },
      key,
      expected,
      now,
    ),
  );
});
test("MIME preview only extracts bounded plain text; ignores HTML and attachments", () => {
  const result = messagePreview({
    id: "abc",
    payload: {
      headers: [{ name: "From", value: "Person <person@example.com>" }],
      parts: [
        {
          mimeType: "text/html",
          body: {
            data: Buffer.from("<script>bad</script>").toString("base64url"),
          },
        },
        {
          mimeType: "text/plain",
          body: { data: Buffer.from("x".repeat(6000)).toString("base64url") },
        },
        {
          mimeType: "text/plain",
          filename: "private.txt",
          body: { attachmentId: "secret" },
        },
      ],
    },
  });
  assert.equal(result.text.length, 5000);
  assert.equal(result.bodyTruncated, true);
  assert.equal(result.hasAttachments, true);
  assert.equal(result.plainTextAvailable, true);
  assert.equal(
    messagePreview({ payload: { mimeType: "text/html" } }).plainTextAvailable,
    false,
  );
  assert.deepEqual(sender(result.from), {
    name: "Person",
    email: "person@example.com",
  });
});
test("provider failures expose only safe codes, never token/error body", async () => {
  await assert.rejects(
    googleRequest(
      "https://example.invalid",
      {},
      async () =>
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "secret token",
          }),
          { status: 400 },
        ),
    ),
    (error) =>
      error.message === "RECONNECT_REQUIRED" &&
      !String(error).includes("secret"),
  );
  await assert.rejects(
    googleRequest("https://example.invalid", {}, async () => {
      throw new Error("secret request token");
    }),
    /GMAIL_UNAVAILABLE/,
  );
  assert.deepEqual(
    await googleRequest(
      "https://example.invalid",
      {},
      async () => new Response('{"messages":[]}'),
    ),
    { messages: [] },
  );
});
