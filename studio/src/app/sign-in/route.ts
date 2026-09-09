import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { practiceConfigured } from "@/lib/practice-config";
export async function GET() {
  if (!practiceConfigured()) redirect("/practice");
  redirect(await getSignInUrl());
}
