import { redirect } from "next/navigation";
export default async function LegacyPracticePage({
  searchParams,
}: {
  searchParams: Promise<{
    authError?: string;
    gmailStatus?: string;
    gmailTenant?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["authError", "gmailStatus", "gmailTenant"] as const)
    if (params[key]) query.set(key, params[key]!);
  redirect(
    `${params.gmailStatus ? "/app/settings" : "/app"}${query.size ? `?${query}` : ""}`,
  );
}
