import type { ComponentProps } from 'react';

// The production site is static: navigate to exported documents without
// depending on a live RSC server for client-side route transitions.
export default function SiteLink(props: ComponentProps<'a'>) {
  return <a {...props} />;
}
