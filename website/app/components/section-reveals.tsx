'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function SectionReveals() {
  const pathname = usePathname();

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>(
      '.reading-section, .booking-section, .practice-intro, .practice-item, .closing-conviction',
    ));
    const reveal = (section: HTMLElement) => {
      section.classList.remove('reveal-pending');
      observer.unobserve(section);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement);
      });
    }, { threshold: 0, rootMargin: window.matchMedia('(max-width: 800px)').matches ? '0px 0px 180px 0px' : '0px 0px -32px 0px' });

    sections.forEach((section) => {
      // Keep server-rendered and initially visible content readable immediately.
      if (section.getBoundingClientRect().top < window.innerHeight) return;
      section.classList.add('section-reveal', 'reveal-pending');
      observer.observe(section);
    });
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        const section = event.target.closest<HTMLElement>('.reveal-pending');
        if (section) reveal(section);
      }
    };
    const onMotionChange = () => {
      if (reduced.matches) sections.forEach(reveal);
    };
    document.addEventListener('focusin', onFocus);
    reduced.addEventListener('change', onMotionChange);
    return () => {
      observer.disconnect();
      sections.forEach((section) => section.classList.remove('section-reveal', 'reveal-pending'));
      document.removeEventListener('focusin', onFocus);
      reduced.removeEventListener('change', onMotionChange);
    };
  }, [pathname]);

  return null;
}
