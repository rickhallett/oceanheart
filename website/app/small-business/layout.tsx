import type { Metadata } from 'next';
import './small-business.css';
export const metadata: Metadata = {
  title: 'Practical AI for small businesses | Oceanheart',
  description: 'Explore practical AI guidance with Rick Hallett. Hands-on help with real business tasks, reusable examples and further consultancy when useful.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Practical AI for small businesses | Oceanheart', description: 'Find a useful starting point in your own working day.', images: ['/images/small-business/high-street.webp'] },
};
export default function Layout({ children }: { children: React.ReactNode }) { return <div className="sb-root">{children}</div>; }
