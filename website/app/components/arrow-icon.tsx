type Direction = 'diagonal' | 'right' | 'left' | 'down' | 'down-right';
const paths: Record<Direction, string> = {
  diagonal: 'M3 13 13 3M3 3h10v10',
  right: 'M2 8h12M9 3l5 5-5 5',
  left: 'M14 8H2M7 3 2 8l5 5',
  down: 'M8 2v12M3 9l5 5 5-5',
  'down-right': 'M3 3l10 10M3 13h10V3',
};
export function ArrowIcon({ direction = 'diagonal' }: { direction?: Direction }) {
  return <svg aria-hidden="true" focusable="false" width="1em" height="1em" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block', verticalAlign: '-0.1em', flexShrink: 0 }}>
    <path d={paths[direction]} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
