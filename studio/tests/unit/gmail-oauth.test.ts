import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { POST } from "../../src/app/practice/integrations/gmail/connect/route";
import { GET } from "../../src/app/practice/integrations/gmail/callback/route";
import {
  gmailCookie,
  openGmailCookie,
  sealGmailCookie,
  codeHash,
} from "../../src/lib/gmail-oauth";
const action = vi.hoisted(() => vi.fn());
vi.mock("@workos-inc/authkit-nextjs", () => ({ withAuth: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = vi.fn();
    action = action;
  },
}));
const origin = "https://staging.example.test",
  binding = "a".repeat(64),
  state = "opaque-state";
function pending() {
  return {
    v: 1 as const,
    state,
    browserBinding: binding,
    userId: "user_test",
    sessionId: "session_test",
    tenantId: "tenant",
    expiresAt: Date.now() + 600000,
  };
}
function callback(
  query = `state=${state}&code=private-code`,
  cookie = sealGmailCookie(pending()),
) {
  return new NextRequest(
    `http://localhost/practice/integrations/gmail/callback?${query}`,
    { headers: { cookie: `${gmailCookie}=${cookie}` } },
  );
}
beforeEach(() => {
  vi.stubEnv("WORKOS_CLIENT_ID", "client_test");
  vi.stubEnv("WORKOS_API_KEY", "test-key");
  vi.stubEnv("WORKOS_COOKIE_PASSWORD", "x".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", origin + "/callback");
  vi.stubEnv("GMAIL_ROUTE_SIGNING_KEY", Buffer.alloc(32, 1).toString("base64"));
  vi.mocked(withAuth).mockResolvedValue({
    user: { id: "user_test" },
    sessionId: "session_test",
    accessToken: "private-access-token",
  } as never);
  action.mockResolvedValue({
    tenantId: "tenant",
    mailbox: "test@example.invalid",
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("rejects cross-origin connect before invoking auth/backend", async () => {
  const response = await POST(
    new NextRequest(origin + "/practice/integrations/gmail/connect", {
      method: "POST",
      headers: { origin: "https://attacker.test" },
      body: new URLSearchParams({ tenantId: "tenant" }),
    }),
  );
  expect(response.status).toBe(403);
  expect(withAuth).not.toHaveBeenCalled();
  expect(action).not.toHaveBeenCalled();
});
it("connect issues HttpOnly expiring state and server-only session proof", async () => {
  action.mockResolvedValue({
    state,
    authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
  });
  const response = await POST(
    new NextRequest("http://localhost/practice/integrations/gmail/connect", {
      method: "POST",
      headers: { origin },
      body: new URLSearchParams({ tenantId: "tenant" }),
    }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("Secure");
  expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  const args = action.mock.calls[0][1];
  expect(JSON.parse(args.routeProof.payload)).toMatchObject({
    purpose: "begin",
    userId: "user_test",
    sessionId: "session_test",
    tenantId: "tenant",
  });
  expect(response.headers.get("location")).not.toContain(
    args.routeProof.signature,
  );
  expect(
    openGmailCookie(
      response.cookies.get(gmailCookie)?.value,
      "user_test",
      "session_test",
    ).state,
  ).toBe(state);
});
it.each([
  "tampered",
  "other-user",
  "other-session",
  "expired",
  "wrong-state",
  "duplicate-state",
])("rejects %s callback without token exchange", async (kind) => {
  let value = pending(),
    cookie: string;
  if (kind === "other-user") value.userId = "other";
  if (kind === "other-session") value.sessionId = "other";
  if (kind === "expired") value.expiresAt = Date.now() - 1;
  cookie = sealGmailCookie(value);
  if (kind === "tampered") cookie += "x";
  const query =
    kind === "wrong-state"
      ? "state=wrong&code=private"
      : kind === "duplicate-state"
        ? `state=${state}&state=${state}&code=private`
        : `state=${state}&code=private`;
  const response = await GET(callback(query, cookie));
  expect(action).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toContain("gmailStatus=failed");
  expect(response.cookies.get(gmailCookie)?.value).toBe("");
});
it("callback binds exact code/session and redirects to configured origin without leaking provider values", async () => {
  const response = await GET(callback());
  expect(action).toHaveBeenCalledOnce();
  expect(JSON.parse(action.mock.calls[0][1].routeProof.payload)).toMatchObject({
    purpose: "complete",
    state,
    sessionId: "session_test",
    codeHash: codeHash("private-code"),
  });
  expect(response.headers.get("location")).toBe(
    origin + "/practice?gmailStatus=connected&gmailTenant=tenant",
  );
  expect(response.headers.get("location")).not.toContain("private");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.cookies.get(gmailCookie)?.value).toBe("");
});
it("denial clears browser state and never exchanges a code", async () => {
  const response = await GET(
    callback(`state=${state}&error=access_denied&error_description=private`),
  );
  expect(action).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toContain("gmailStatus=denied");
  expect(response.headers.get("location")).not.toContain("private");
  expect(response.cookies.get(gmailCookie)?.value).toBe("");
});
