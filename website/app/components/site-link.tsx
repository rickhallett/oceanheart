 'use client';
import { useEffect, useState, type ComponentProps } from 'react';
import { practiceHref } from '../../lib/practice-routing.mjs';
export default function SiteLink({ href, ...props }: ComponentProps<'a'>) {
  const [hostname, setHostname] = useState('');
  useEffect(() => setHostname(window.location.hostname), []);
  return <a {...props} href={practiceHref(href, hostname)} />;
}
