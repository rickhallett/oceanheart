import assert from "node:assert/strict";
import test from "node:test";

import { studioRuntimeEnvironment } from "../../src/release/environment.ts";

test("Studio release forwards only the explicit application configuration", () => {
  const environment = studioRuntimeEnvironment({
    WORKOS_CLIENT_ID: "client_syntheticc0001",
    WORKOS_API_KEY: "test-only-secret",
    WORKOS_COOKIE_PASSWORD: "cookie-secret",
    NEXT_PUBLIC_CONVEX_URL: "https://synthetic.convex.cloud",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://synthetic.example/callback",
    STUDIO_PRIVATE_WORKFLOW: "clara",
    STUDIO_CLARA_RUNTIME_URL: "http://127.0.0.1:43760/v1/clara",
    BENCH_CONVEX_TEAM_TOKEN: "must-not-forward",
    CONVEX_DEPLOY_KEY: "must-not-forward",
    PATH: "/private/controller/path",
  });
  assert.deepEqual(environment, {
    WORKOS_CLIENT_ID: "client_syntheticc0001",
    WORKOS_API_KEY: "test-only-secret",
    WORKOS_COOKIE_PASSWORD: "cookie-secret",
    NEXT_PUBLIC_CONVEX_URL: "https://synthetic.convex.cloud",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://synthetic.example/callback",
    STUDIO_PRIVATE_WORKFLOW: "clara",
    STUDIO_CLARA_RUNTIME_URL: "http://127.0.0.1:43760/v1/clara",
  });
});
