'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from '@/app/components/site-link';

import { CardArt, type CardKind } from './card-art';

import { bookingLink, type BookingKind } from '../../lib/bookings';

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) { setOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  return <header className="editorial-header">
    <Link href="/" className="wordmark" aria-label="oceanheart.ai home">oceanheart.ai</Link>
    <button ref={menuButton} className="mobile-menu-toggle" aria-label={open ? 'close menu' : 'open menu'} aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}><span className="menu-strokes" aria-hidden="true"><span /><span /></span></button>
    <nav id="primary-navigation" data-open={open} aria-label="primary navigation">
      <Link onClick={() => setOpen(false)} href="/conversations-with-ai">ai guidance</Link>
      <Link onClick={() => setOpen(false)} href="/systems-work">websites &amp; systems</Link>
      <Link onClick={() => setOpen(false)} href="/human-work">therapy &amp; bodywork</Link>
      <Link onClick={() => setOpen(false)} href="/about">about rick</Link>
    </nav>
  </header>;
}

export function BookingActions({ kinds = ['exploration'] }: { kinds?: BookingKind[] }) {
  const links = kinds.map(kind => ({ kind, ...bookingLink(kind) }));
  return <div className="booking-actions-wrap">
    <div className="booking-actions">{links.map((link, index) => <a key={link.kind}
      className={'booking-link' + (index > 0 ? ' booking-link-secondary' : '')} href={link.href}>
      {link.label}<span aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" focusable="false"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
    </a>)}</div>

  </div>;
}

export function Booking({ invitation, description = 'A free, short conversation to explore what you’re looking for and whether working together feels right.', kinds = ['exploration'] }: {
  invitation: string; description?: string; kinds?: BookingKind[];
}) {
  return <section className="booking-section" id="book" aria-labelledby="booking-title">
    <p className="eyebrow">Your next step</p>
    <h2 id="booking-title">{invitation}</h2>
    <p>{description}</p>
    <BookingActions kinds={kinds} />
  </section>;
}

export function Footer() {
  return <footer className="editorial-footer"><Link className="wordmark" href="/">oceanheart.ai</Link><Link href="/about">about rick</Link><Link href="/selected-work">selected work</Link><Link href="/notes">notes</Link><a href="mailto:rick@oceanheart.ai">email rick</a><span>therapy · ai guidance · digital systems</span></footer>;
}

export function ReadingSection({ label, children }: { label: string; children: ReactNode }) {
  return <section className="reading-section"><h2 className="eyebrow">{label}</h2><div>{children}</div></section>;
}

export function EditorialPage({ tone, label, title, intro, children, invitation, bookingKinds, bookingDescription, afterBooking }: {
  tone: 'light' | 'night' | 'human' | 'about';
  label: string; title: ReactNode; intro: ReactNode; children: ReactNode; invitation: string;
  bookingKinds?: BookingKind[]; bookingDescription?: string; afterBooking?: ReactNode;
}) {
  return <div className={'editorial-page editorial-' + tone}>
    <div className="card-opening-art" aria-hidden="true"><CardArt kind={({ light: 'horizon', night: 'currents', human: 'embodied', about: 'heart' } as Record<string, CardKind>)[tone]} /></div>
    <div className="editorial-foreground">
      <SiteNav />
      <main>
        <section className="editorial-opening">
          <p className="eyebrow">{label}</p>
          <h1>{title}</h1>
          <p className="editorial-intro">{intro}</p>
          <BookingActions kinds={bookingKinds} />
          <a className="read-on" href="#read" aria-label="Continue reading"><span className="scroll-cue" aria-hidden="true" /></a>
        </section>
        <div id="read" className="editorial-reading">{children}</div>
        <Booking invitation={invitation} kinds={bookingKinds} description={bookingDescription} />
        {afterBooking && <div className="editorial-reading">{afterBooking}</div>}
      </main>
      <Footer />
    </div>
  </div>;
}
