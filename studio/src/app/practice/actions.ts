"use server";
import { signOut } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { practiceConfigured } from "@/lib/practice-config";
import { claraInstanceConfigured } from "@/lib/clara-instance";
export async function signOutPractice() {
  if (!practiceConfigured() && !claraInstanceConfigured()) redirect("/app");
  await signOut({
    returnTo: new URL("/app", process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI)
      .href,
  });
}
