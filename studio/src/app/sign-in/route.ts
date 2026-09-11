import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { practiceConfigured } from "@/lib/practice-config";
import { claraInstanceConfigured } from "@/lib/clara-instance";
export async function GET() {
  if (!practiceConfigured() && !claraInstanceConfigured()) redirect("/app");
  redirect(await getSignInUrl());
}
