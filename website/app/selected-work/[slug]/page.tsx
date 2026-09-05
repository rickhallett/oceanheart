
import { ArrowIcon } from '@/app/components/arrow-icon';
import Link from '@/app/components/site-link';
import { notFound } from 'next/navigation';
import { DepthPage } from '../../components/depth';
import { selectedWork } from '../../../lib/selected-work';
import { projectTechnical } from '../../../lib/project-technical';
import { projectImages } from '../../../lib/project-images';
import { ProjectLead, ProjectMoreViews } from '../../components/project-gallery';

export function generateStaticParams() { return selectedWork.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = selectedWork.find(item => item.slug === slug);
  return { title: `${work?.title ?? 'Work'} | Oceanheart`, description: work?.summary };
}
export default async function WorkDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = selectedWork.find(item => item.slug === slug);
  if (!work) notFound();
  const technical = projectTechnical[slug];
  const images = projectImages[slug] ?? [];
  return <DepthPage title={work.title} label={work.kind}>
    <p className="depth-intro">{work.summary}</p>
    <ProjectLead images={images} />
    <div className="depth-prose">{work.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}<p className="depth-status">{work.status}</p></div>
    <ProjectMoreViews images={images} />
    <details className="technical-detail"><summary>Technical detail</summary>
      <div className="technical-content">
        <p className="technical-basis">{technical.basis}</p>
        {technical.sections.map(section => <section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}
        <p className="technical-stack"><strong>Stack / components</strong><br />{work.stack}</p>
      </div>
    </details>
    {'url' in work && work.url && <a className="depth-next" href={work.url}>{work.kind === 'Client work' ? 'Visit the project' : 'Read the original technical account'} <ArrowIcon /></a>}
    <Link className="depth-next" href="/systems-work">Back to Systems work</Link>
  </DepthPage>;
}
