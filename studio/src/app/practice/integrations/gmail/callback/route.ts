import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { gmailApi } from "@/components/practice/gmail-api";
import {
  gmailConfig,
  gmailCookie,
  gmailPath,
  gmailProof,
  openGmailCookie,
  codeHash,
} from "@/lib/gmail-oauth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = gmailConfig().origin;
  } catch {
    return new NextResponse("Gmail connection is not configured.", {
      status: 503,
    });
  }
  const target = new URL("/practice", origin);
  target.searchParams.set("gmailStatus", "failed");
  try {
    const auth = await withAuth();
    if (!auth.user || !auth.sessionId || !auth.accessToken)
      throw Error("UNAUTHENTICATED");
    const pending = openGmailCookie(
      request.cookies.get(gmailCookie)?.value,
      auth.user.id,
      auth.sessionId,
    );
    const params = request.nextUrl.searchParams;
    if (
      params.getAll("state").length !== 1 ||
      params.get("state") !== pending.state
    )
      throw Error("GMAIL_STATE_INVALID");
    target.searchParams.set("gmailTenant", pending.tenantId);
    if (params.has("error")) {
      target.searchParams.set("gmailStatus", "denied");
    } else {
      const code = params.get("code");
      if (params.getAll("code").length !== 1 || !code || code.length > 4096)
        throw Error("GMAIL_CODE_INVALID");
      const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      client.setAuth(auth.accessToken);
      const result = await client.action(gmailApi.complete, {
        state: pending.state,
        browserBinding: pending.browserBinding,
        code,
        routeProof: gmailProof({
          purpose: "complete",
          userId: auth.user.id,
          sessionId: auth.sessionId,
          browserBinding: pending.browserBinding,
          state: pending.state,
          codeHash: codeHash(code),
        }),
      });
      if (result.tenantId !== pending.tenantId)
        throw Error("GMAIL_STATE_INVALID");
      target.searchParams.set("gmailStatus", "connected");
    }
  } catch {
    /* Never include OAuth codes, provider errors or tokens in a response or log. */
  }
  const response = NextResponse.redirect(target, 303);
  response.cookies.set(gmailCookie, "", {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: gmailPath,
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
