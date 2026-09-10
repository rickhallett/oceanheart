import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { practiceConfigured } from "@/lib/practice-config";

export async function GET(request: NextRequest) {
  if (!practiceConfigured())
    return NextResponse.redirect(new URL("/app", request.url));
  return handleAuth({
    returnPathname: "/app",
    // Next may expose an internal hostname; keep redirect and session-cookie origins aligned.
    baseURL: new URL(process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI!).origin,
    onError: () =>
      NextResponse.redirect(
        new URL(
          "/app?authError=1",
          process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
        ),
      ),
  })(request);
}
