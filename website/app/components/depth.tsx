import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteNav, Footer } from './editorial';
import { selectedWork, selectedNotes } from '../../lib/selected-work';

export function DepthPage({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return <div className="editorial-page editorial-light"><SiteNav /><main className="depth-page"><p className="eyebrow">{label}</p><h1>{title}</h1>{children}</main><Footer /></div>;
}

export function WorkLinks({ slugs }: { slugs: string[] }) {
  return <div className="depth-links">{slugs.map(slug => {
    const work = selectedWork.find(item => item.slug === slug)!;
    return <Link key={slug} href={'/selected-work/' + slug}><strong>{work.title} <span aria-hidden="true">↗</span></strong><span>{work.summary}</span></Link>;
  })}</div>;
}

export function NoteLinks({ limit = selectedNotes.length }: { limit?: number }) {
  return <div className="depth-links">{selectedNotes.slice(0, limit).map(note => <Link key={note.href} href={note.href}><strong>{note.title} <span aria-hidden="true">↗</span></strong><span>{note.summary}</span><small>Read the full note</small></Link>)}</div>;
}
