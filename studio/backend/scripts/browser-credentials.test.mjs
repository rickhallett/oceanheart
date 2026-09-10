import { test } from "node:test";
import assert from "node:assert/strict";
import { browserCredentials } from "./browser-credentials.mjs";

test("browser disk projection excludes all session and provider secrets", () => {
  const state = {runId:"run",target:"staging",clientId:"public",apiKey:"api-secret",accounts:[{
    role:"owner",email:"owner@example.com",password:"browser-password",userId:"user_fixture",
    accessToken:"access-secret",refreshToken:"refresh-secret",identity:"issuer|subject",futureSecret:"future-secret",
  }]};
  const result = browserCredentials(state);
  assert.deepEqual(result,{runId:"run",target:"staging",clientId:"public",accounts:[{
    role:"owner",email:"owner@example.com",password:"browser-password",userId:"user_fixture",
  }]});
  const serialized = JSON.stringify(result);
  for (const secret of ["api-secret","access-secret","refresh-secret","future-secret"]) assert.ok(!serialized.includes(secret));
  assert.equal(state.accounts[0].refreshToken,"refresh-secret");
});
test("partial fixture checkpoint stores only generated browser credentials", () => {
  assert.deepEqual(browserCredentials({runId:"run",target:"staging",clientId:"public",accounts:[{
    role:"owner",email:"owner@example.com",password:"password",
  }]}).accounts,[{role:"owner",email:"owner@example.com",password:"password"}]);
});
