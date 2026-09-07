import type { Metadata } from 'next';
import { variants } from '../small-business/content';
import VariantPage from '../small-business/variant-page';
import '../small-business/small-business.css';

const consulting = variants.find(variant => variant.slug === 'fair-questions')!;
const title = 'AI consulting for small businesses | Oceanheart';
const url = 'https://www.oceanheart.ai/consulting';

export const metadata: Metadata = {
  title,
  description: consulting.intro,
  alternates: { canonical: url },
  robots: { index: true, follow: true },
  openGraph: { title, description: consulting.intro, url, images: ['/images/small-business/high-street.webp'] },
  twitter: { card: 'summary_large_image', title, description: consulting.intro, images: ['/images/small-business/high-street.webp'] },
};

export default function Consulting() {
  return <div className="sb-root"><VariantPage v={consulting} official /></div>;
}
