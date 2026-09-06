import type { Metadata } from 'next';
export const metadata: Metadata = {
 metadataBase: new URL('https://dev.oceanheart.ai'),
 openGraph: { title: 'Oceanheart Dev — Design & engineering', description: 'Websites, software and practical AI guidance with Rick Hallett.', url: 'https://dev.oceanheart.ai/systems-work', images: ['https://www.oceanheart.ai/og.png'] },
 twitter: { title: 'Oceanheart Dev — Design & engineering', description: 'Websites, software and practical AI guidance with Rick Hallett.' },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
