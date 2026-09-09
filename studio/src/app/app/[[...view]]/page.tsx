import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/workspace";
import { modules } from "@/components/workspace/model";
export const metadata: Metadata = {
  title: "Your practice | oceanheart Studio",
  robots: { index: false, follow: false },
};
export function generateStaticParams() {
  return [{ view: [] }, ...modules.map(([view]) => ({ view: [view] }))];
}
export default function AppPage() {
  return <Workspace />;
}
