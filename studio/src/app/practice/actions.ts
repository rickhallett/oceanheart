"use server";
import { signOut } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { practiceConfigured } from "@/lib/practice-config";
export async function signOutPractice() {
  if (!practiceConfigured()) redirect("/practice");
  await signOut({
    returnTo: new URL("/practice", process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI)
      .href,
  });
}
