import { randomBytes } from "node:crypto";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { gmailApi } from "@/components/practice/gmail-api";
import type { TenantId } from "@/components/practice/api";
import {
  gmailConfig,
  gmailCookie,
  gmailPath,
  gmailProof,
  sealGmailCookie,
} from "@/lib/gmail-oauth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  let origin: string;
  try {
    origin = gmailConfig().origin;
  } catch {
    return new NextResponse("Gmail connection is not configured.", {
      status: 503,
    });
  }
  if (request.headers.get("origin") !== origin)
    return new NextResponse("Request origin was not accepted.", {
      status: 403,
    });
  try {
    const auth = await withAuth();
    if (!auth.user || !auth.sessionId || !auth.accessToken)
      return new NextResponse("Sign in again.", { status: 401 });
    const form = await request.formData(),
      tenantId = form.get("tenantId");
    if (typeof tenantId !== "string" || !tenantId || tenantId.length > 100)
      return new NextResponse("Choose a practice.", { status: 400 });
    const browserBinding = randomBytes(32).toString("hex"),
      client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    client.setAuth(auth.accessToken);
    const result = await client.action(gmailApi.begin, {
      tenantId: tenantId as TenantId,
      browserBinding,
      routeProof: gmailProof({
        purpose: "begin",
        userId: auth.user.id,
        sessionId: auth.sessionId,
        tenantId,
        browserBinding,
      }),
    });
    const url = new URL(result.authorizationUrl);
    if (
      url.origin !== "https://accounts.google.com" ||
      url.pathname !== "/o/oauth2/v2/auth" ||
      url.searchParams.get("state") !== result.state
    )
      throw Error("GMAIL_PROVIDER_RESPONSE");
    const response = NextResponse.redirect(url, 303);
    response.cookies.set(
      gmailCookie,
      sealGmailCookie({
        v: 1,
        state: result.state,
        browserBinding,
        userId: auth.user.id,
        sessionId: auth.sessionId,
        tenantId,
        expiresAt: Date.now() + 600000,
      }),
      {
        httpOnly: true,
        secure: origin.startsWith("https:"),
        sameSite: "lax",
        path: gmailPath,
        maxAge: 600,
      },
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/practice?gmailStatus=failed", origin),
      303,
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
