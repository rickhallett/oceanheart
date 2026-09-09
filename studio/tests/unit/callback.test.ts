import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { GET } from "../../src/app/callback/route";
vi.mock("@workos-inc/authkit-nextjs", () => ({ handleAuth: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("WORKOS_CLIENT_ID", "client_test");
  vi.stubEnv("WORKOS_API_KEY", "test-key");
  vi.stubEnv("WORKOS_COOKIE_PASSWORD", "x".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it.each([
  "http://127.0.0.1:4341",
  "https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app",
])(
  "passes configured %s to SDK callback instead of the internal request hostname",
  async (origin) => {
    vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", `${origin}/callback`);
    const response = NextResponse.redirect(`${origin}/practice`);
    const sdkHandler = vi.fn().mockResolvedValue(response);
    vi.mocked(handleAuth).mockReturnValue(sdkHandler);
    const request = new NextRequest(
      "http://localhost:4341/callback?code=test&state=test",
    );
    expect(await GET(request)).toBe(response);
    expect(handleAuth).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: origin, returnPathname: "/practice" }),
    );
    expect(sdkHandler).toHaveBeenCalledWith(request);
    const options = vi.mocked(handleAuth).mock.calls[0][0]!;
    const failed = await options.onError!({
      error: new Error("private provider error"),
      request,
    });
    expect(failed.headers.get("location")).toBe(
      `${origin}/practice?authError=1`,
    );
  },
);
it("never invokes callback SDK without configuration", async () => {
  vi.stubEnv("WORKOS_API_KEY", "");
  const response = await GET(
    new NextRequest("http://127.0.0.1:4341/callback?code=test"),
  );
  expect(new URL(response.headers.get("location")!).pathname).toBe("/practice");
  expect(handleAuth).not.toHaveBeenCalled();
});
