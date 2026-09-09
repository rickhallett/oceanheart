import type { Metadata } from "next";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { PracticeApp } from "@/components/practice/practice-app";
import {
  PracticeShell,
  PracticeUnavailable,
} from "@/components/practice/practice-ui";
import { practiceConfigured } from "@/lib/practice-config";
import "@/components/practice/practice.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your practice · oceanheart Studio",
  robots: { index: false, follow: false },
};
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{
    authError?: string;
    gmailStatus?: string;
    gmailTenant?: string;
  }>;
}) {
  if (!practiceConfigured()) return <PracticeUnavailable />;
  const { accessToken: _accessToken, ...auth } = await withAuth();
  if (!auth.user)
    return (
      <PracticeShell>
        <section className="lp-intro">
          <h1>Your practice</h1>
          <p>Sign in to manage your practice and tasks.</p>
          {(await searchParams).authError && (
            <p role="alert">
              Sign-in could not be completed. Please try again.
            </p>
          )}
          <a className="lp-button" href="/sign-in">
            Sign in
          </a>
        </section>
      </PracticeShell>
    );
  const params = await searchParams;
  const gmailReturn = ["connected", "denied", "failed"].includes(
    params.gmailStatus ?? "",
  )
    ? { status: params.gmailStatus!, tenantId: params.gmailTenant }
    : undefined;
  return (
    <PracticeApp
      convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL!}
      initialAuth={auth}
      gmailReturn={gmailReturn}
    />
  );
}
