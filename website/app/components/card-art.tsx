/** Decorative views of the approved fronts. Text is always live HTML.
 * CSS clips the existing lettering; the source artwork stays untouched. */
export type CardKind = 'horizon' | 'currents' | 'embodied' | 'heart' | 'stone';
export function CardArt({ kind }: { kind: CardKind }) {
  if (kind === 'currents') return <div className="card-art card-currents" aria-hidden="true"><svg viewBox="0 0 900 700" fill="none" preserveAspectRatio="xMidYMid slice">{Array.from({length: 9}, (_, i) => <path key={i} d={`M -100 ${80+i*66} C 270 ${60+i*72}, 240 ${570-i*30}, 520 ${360+i*9} S 770 ${150+i*40}, 1020 ${280+i*35}`} stroke="currentColor" strokeWidth="1.15" />)}</svg></div>;
  return <div className={'card-art card-' + kind} aria-hidden="true"><div className="card-art-image" /></div>;
}
