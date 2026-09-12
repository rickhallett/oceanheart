import type { Metadata } from 'next';
import StudioLanding from './studio/page';

const title = 'Studio + Oceanheart | More room for the work that matters';
const description = 'AI agents for everyday practice administration, configured, tested and maintained with Rick at Oceanheart. A private workspace shaped around you.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://www.oceanheart.ai/' },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: 'https://www.oceanheart.ai/' },
  twitter: { card: 'summary_large_image', title, description },
};

export default StudioLanding;
