"use server";
import { signOut } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { practiceConfigured } from "@/lib/practice-config";
export async function signOutPractice() {
  if (!practiceConfigured()) redirect("/app");
  await signOut({
    returnTo: new URL("/app", process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI)
      .href,
  });
}
