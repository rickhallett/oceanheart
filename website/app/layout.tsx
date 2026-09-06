import type { Metadata } from 'next';
import './globals.css';
import './stay-human.css';
import { SectionReveals } from './components/section-reveals';

const siteUrl = new URL('https://www.oceanheart.ai');
const title = 'Integrative therapeutic practice | Oceanheart';
const description =
  'Conversation, breath and body-based inquiry with Rick Hallett. An integrative therapeutic practice shaped around your lived experience.';

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
        alt: 'Oceanheart — Stay human.',
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
