import type { Metadata } from "next";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { Workspace } from "@/components/workspace/workspace";
import { WorkspaceEntry } from "@/components/workspace/entry";
import { PracticeApp } from "@/components/practice/practice-app";
import { practiceConfigured } from "@/lib/practice-config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your practice | oceanheart Studio",
  robots: { index: false, follow: false },
};
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  // Unconfigured builds remain an explicit demonstration. Configured environments
  // always use verified identity and live records, never browser sample data.
  if (!practiceConfigured()) return <Workspace />;
  const { accessToken: _accessToken, ...auth } = await withAuth();
  if (!auth.user)
    return <WorkspaceEntry authError={!!(await searchParams).authError} />;
  return (
    <PracticeApp
      convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL!}
      initialAuth={auth}
    />
  );
}
