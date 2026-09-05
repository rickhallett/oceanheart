import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practical AI guidance with Rick — Oceanheart',
  description: 'Guided AI sessions using your own tasks and ideas while keeping your judgement involved. Conversations with AI is currently a free pilot study.',
};

export default function ConversationsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
