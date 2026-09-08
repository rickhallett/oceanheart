import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import {
  PracticeApp,
  PracticeUnavailable,
} from "@/components/practice/practice-app";
import "@/components/practice/practice.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your practice · Oceanheart Studio",
  robots: { index: false, follow: false },
};

export default function PracticePage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!publishableKey || !convexUrl || !process.env.CLERK_SECRET_KEY)
    return <PracticeUnavailable />;
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/practice"
      appearance={{
        variables: {
          colorPrimary: "#dba67f",
          colorBackground: "#13212a",
          colorForeground: "#eee4d9",
          colorMutedForeground: "#aab8bf",
          colorInput: "#0b171e",
          colorInputForeground: "#eee4d9",
          borderRadius: "12px",
          fontFamily: "var(--font-sans), sans-serif",
        },
      }}
    >
      <PracticeApp convexUrl={convexUrl} />
    </ClerkProvider>
  );
}
