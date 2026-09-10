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
  searchParams: Promise<{ authError?: string; demo?: string }>;
}) {
  const params = await searchParams;
  // Explicit public demo uses only fictional browser-local state. It never
  // mounts auth/data providers or imports samples into a signed-in practice.
  if (params.demo === "1") return <Workspace demo />;
  if (!practiceConfigured()) return <Workspace />;
  const { accessToken: _accessToken, ...auth } = await withAuth();
  if (!auth.user)
    return <WorkspaceEntry authError={!!params.authError} />;
  return (
    <PracticeApp
      convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL!}
      initialAuth={auth}
    />
  );
}
