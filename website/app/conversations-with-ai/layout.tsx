import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://dev.oceanheart.ai'),
  openGraph: { title: 'Practical AI guidance | Oceanheart Dev', url: 'https://dev.oceanheart.ai/conversations-with-ai', description: 'Guided AI sessions with Rick Hallett.', images: ['https://www.oceanheart.ai/og.png'] },
  twitter: { title: 'Practical AI guidance | Oceanheart Dev', description: 'Guided AI sessions with Rick Hallett.' },
  title: 'Practical AI guidance with Rick — Oceanheart',
  description: 'Guided AI sessions using your own tasks and ideas while keeping your judgement involved. Conversations with AI is currently a free pilot study.',
};

export default function ConversationsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
