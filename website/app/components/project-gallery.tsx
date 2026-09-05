import type { ProjectImage } from '../../lib/project-images';
import imageSizes from '../../lib/project-image-sizes.json';
import Image from 'next/image';

function Screen({ screen, lead = false }: { screen: ProjectImage; lead?: boolean }) {
  const src = `/images/projects/${screen.file}.webp`;
  const size = (imageSizes as Record<string, { width: number; height: number }>)[screen.file];
  return <figure className="project-screen">
    <a className="project-screen-image" href={src} target="_blank" rel="noreferrer" aria-label={`Open full-size image: ${screen.title}`}>
      <Image unoptimized src={src} alt={screen.alt} width={size.width} height={size.height} loading={lead ? 'eager' : 'lazy'} decoding="async" />
    </a>
    <figcaption><span className="screen-kind">{screen.kind}</span><h2>{screen.title}</h2><p>{screen.caption}</p><a href={src} target="_blank" rel="noreferrer">View full size ↗</a></figcaption>
  </figure>;
}

export function ProjectLead({ images }: { images: ProjectImage[] }) {
  return images[0] ? <Screen screen={images[0]} lead /> : null;
}

export function ProjectMoreViews({ images }: { images: ProjectImage[] }) {
  if (images.length < 2) return null;
  return <details className="project-more"><summary>More views <span>({images.length - 1})</span></summary><div>{images.slice(1).map(screen => <Screen screen={screen} key={screen.file} />)}</div></details>;
}
