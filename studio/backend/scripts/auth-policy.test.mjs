import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuthConfig } from "../auth-policy.ts";
const clerk = {
  mode: "clerk",
  clerkDomain: "https://example.clerk.accounts.dev",
};
const local = {
  mode: "local-jwt",
  issuer: "https://studio-test.invalid",
  audience: "studio-local-verification",
  jwks: "data:text/plain;charset=utf-8;base64,eyJrZXlzIjpbXX0=",
};
test("managed Clerk uses the exact issuer and convex audience", () =>
  assert.deepEqual(buildAuthConfig(clerk), {
    providers: [{ domain: clerk.clerkDomain, applicationID: "convex" }],
  }));
test("only explicit disabled mode returns no providers", () => {
  assert.deepEqual(buildAuthConfig({ mode: "disabled" }), { providers: [] });
  for (const mode of [undefined, "", " ", "typo"])
    assert.throws(() => buildAuthConfig({ mode }));
});
test("missing and padded Clerk domains fail closed", () => {
  for (const clerkDomain of [
    undefined,
    "",
    " ",
    " https://example.clerk.accounts.dev",
    "http://example.clerk.accounts.dev",
    "https://example.clerk.accounts.dev/path",
  ])
    assert.throws(() => buildAuthConfig({ ...clerk, clerkDomain }));
});
test("provider modes reject mixed or leftover active configuration", () => {
  assert.throws(() => buildAuthConfig({ ...clerk, issuer: local.issuer }));
  assert.throws(() =>
    buildAuthConfig({ ...local, clerkDomain: clerk.clerkDomain }),
  );
  assert.throws(() => buildAuthConfig({ ...clerk, mode: "disabled" }));
});
test("local test provider requires all fields and retains JWT verification settings", () => {
  const config = buildAuthConfig(local);
  assert.equal(config.providers[0].algorithm, "RS256");
  for (const name of ["issuer", "audience", "jwks"])
    assert.throws(() => buildAuthConfig({ ...local, [name]: undefined }));
  assert.throws(() => buildAuthConfig({ ...local, audience: "convex" }));
});
