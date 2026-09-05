import Link from '@/app/components/site-link';
import { notFound } from 'next/navigation';
import { DepthPage } from '../../components/depth';
import { articles, readArticle } from '../../../lib/articles';

export function generateStaticParams() { return articles.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articles.find(item => item.slug === slug);
  if (!article) return {};
  return {
    title: `${article.title} | Oceanheart`, description: article.summary,
    alternates: { canonical: `/blog/${slug}/` },
    openGraph: { title: article.title, description: article.summary, type: 'article', url: `/blog/${slug}/` },
    twitter: { title: article.title, description: article.summary },
  };
}
export default async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = readArticle(slug);
  if (!article) notFound();
  return <DepthPage title={article.title} label="Notes">
    <p className="article-date"><time dateTime={article.date}>{article.date}</time></p>
    <article className="article-prose" dangerouslySetInnerHTML={{ __html: article.html }} />
    {slug === '2026-09-05-when-ai-joins-the-conversation' && <Link className="depth-next" href="/conversations-with-ai">Back to Conversations with AI</Link>}
    <Link className="depth-next" href="/notes">Back to selected notes</Link>
  </DepthPage>;
}
