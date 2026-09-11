import { authkitProxy } from "@workos-inc/authkit-nextjs";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { practiceConfigured } from "./lib/practice-config";
import { claraInstanceConfigured } from "./lib/clara-instance";

const authkit = authkitProxy();
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!practiceConfigured() && !claraInstanceConfigured())
    return NextResponse.next();
  return authkit(request, event);
}
export const config = {
  matcher: [
    "/app/:path*",
    "/practice/:path*",
    "/api/private/clara",
    "/callback",
    "/sign-in",
  ],
};
