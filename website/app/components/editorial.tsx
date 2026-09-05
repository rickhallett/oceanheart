'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
      {link.label}<span aria-hidden="true">↗</span>
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
  return <footer className="editorial-footer"><Link href="/">oceanheart.ai</Link><Link href="/about">about rick</Link><Link href="/selected-work">selected work</Link><Link href="/notes">notes</Link><a href="mailto:rick@oceanheart.ai">email rick</a><span>therapy · ai guidance · digital systems</span></footer>;
}

export function ReadingSection({ label, children }: { label: string; children: ReactNode }) {
  return <section className="reading-section"><h2 className="eyebrow">{label}</h2><div>{children}</div></section>;
}

export function EditorialPage({ tone, image, label, title, intro, children, invitation, bookingKinds, bookingDescription, afterBooking }: {
  tone: 'light' | 'night' | 'human' | 'about';
  image?: string; label: string; title: string; intro: ReactNode; children: ReactNode; invitation: string;
  bookingKinds?: BookingKind[]; bookingDescription?: string; afterBooking?: ReactNode;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = pageRef.current;
    if (!page || !image) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      const opening = page.querySelector<HTMLElement>('.editorial-opening');
      if (opening) page.style.setProperty('--opening-height', `${opening.offsetTop + opening.offsetHeight}px`);
      const progress = Math.min(1, Math.max(0, -page.getBoundingClientRect().top / (window.innerHeight * 1.8)));
      page.style.setProperty('--portrait-veil', reduced.matches ? '0.35' : String(progress * 0.93));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(page.querySelector('.editorial-opening') ?? page);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduced.removeEventListener('change', schedule);
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [image]);
  return <div className={'editorial-page editorial-' + tone} ref={pageRef}>
    {image && <div className="editorial-backdrop" aria-hidden="true">
      <Image src={image} alt="" width={1128} height={1938} unoptimized priority className="editorial-photo" />
      <div className="editorial-veil" />
    </div>}
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
