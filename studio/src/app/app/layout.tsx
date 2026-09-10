import { StudioProvider } from "@/components/studio-provider";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return <StudioProvider application>{children}</StudioProvider>;
}
