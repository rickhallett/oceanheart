import type { Metadata } from 'next';
import './globals.css';
import './stay-human.css';
import { SectionReveals } from './components/section-reveals';

const siteUrl = new URL('https://www.oceanheart.ai');
const title = 'Oceanheart — Therapy, practical AI guidance and bespoke digital systems';
const description =
  'Therapy, standalone massage, practical AI guidance and bespoke websites, software and workflows with Rick Hallett. Explore sessions and free initial conversations.';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    url: siteUrl,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Oceanheart — therapy, AI guidance and digital systems',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html id="top" lang="en" suppressHydrationWarning>
      <body>{children}<SectionReveals /></body>
    </html>
  );
}
