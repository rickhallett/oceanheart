import { authkitProxy } from "@workos-inc/authkit-nextjs";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { practiceConfigured } from "./lib/practice-config";

const authkit = authkitProxy();
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!practiceConfigured()) return NextResponse.next();
  return authkit(request, event);
}
export const config = {
  matcher: ["/app/:path*", "/practice/:path*", "/callback", "/sign-in"],
};
