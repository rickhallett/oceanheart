"use client";

import { useLayoutEffect, useRef } from "react";

/** Keep content and focus mounted while gently introducing a changed view. */
export function useSoftTransition(value: string | number, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(value);
  useLayoutEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    if (!changed || !enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = ref.current?.animate(
      [{ opacity: 0.72 }, { opacity: 1 }],
      { duration: 600, easing: 'cubic-bezier(.25,.1,.25,1)' },
    );
    return () => animation?.cancel();
  }, [value, enabled]);
  return ref;
}
