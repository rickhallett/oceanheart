import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import "@/styles/application-tokens.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
export const metadata: Metadata = {
  metadataBase: new URL("https://studio.oceanheart.ai"),
  title: "oceanheart Studio — Your practice, beautifully put together",
  description:
    "A website, organised enquiries and bookings, and personal ongoing support from a clinician and engineer. Built around your independent practice.",
  openGraph: {
    title: "oceanheart Studio",
    description: "Your practice, beautifully put together.",
    images: ["/ocean-at-dusk.webp"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`light ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
