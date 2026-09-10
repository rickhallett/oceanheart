"use client";

import { useEffect, useRef } from "react";

/** Keep content and focus mounted while gently introducing a changed view. */
export function useSoftTransition(value: string | number, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    if (!changed || !enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = ref.current?.animate(
      [{ opacity: 0.35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
    return () => animation?.cancel();
  }, [value, enabled]);
  return ref;
}
