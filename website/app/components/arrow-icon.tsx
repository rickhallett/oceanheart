export function ArrowIcon({ direction = 'diagonal' }: { direction?: 'diagonal' | 'right' }) {
  return <svg aria-hidden="true" focusable="false" width="1em" height="1em" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block', verticalAlign: '-0.1em', flexShrink: 0 }}>
    <path d={direction === 'right' ? 'M2 8h12M9 3l5 5-5 5' : 'M3 13 13 3M3 3h10v10'} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
