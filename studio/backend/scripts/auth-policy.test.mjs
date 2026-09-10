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
test("WorkOS uses client-scoped verified RS256 providers", () => {
  const clientId = "client_example123";
  assert.deepEqual(buildAuthConfig({mode:"workos",workosClientId:clientId}), {providers:[
    {type:"customJwt",issuer:"https://api.workos.com/",algorithm:"RS256",jwks:`https://api.workos.com/sso/jwks/${clientId}`,applicationID:clientId},
    {type:"customJwt",issuer:`https://api.workos.com/user_management/${clientId}`,algorithm:"RS256",jwks:`https://api.workos.com/sso/jwks/${clientId}`},
  ]});
  for (const workosClientId of [undefined,""," client_abc","other","client_a/b"]) assert.throws(()=>buildAuthConfig({mode:"workos",workosClientId}));
  for (const mode of ["disabled","clerk","local-jwt"]) assert.throws(()=>buildAuthConfig({...local,mode,workosClientId:clientId}));
  assert.throws(()=>buildAuthConfig({...local,mode:"workos",workosClientId:clientId}));
});
