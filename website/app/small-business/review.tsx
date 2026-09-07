'use client';
import { useEffect, useState } from 'react';
import { pathFor, variants } from './content';
import { Visual } from './visuals';
const key='oceanheart-small-business-shortlist-v1';
function readSaved(): string[] { try { const value: unknown=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(value) ? value.filter((x): x is string=>typeof x==='string' && variants.some(v=>v.slug===x)) : []; } catch {return [];} }
function useShortlist() {
 const [saved,setSaved]=useState<string[]>([]);
 const [notice,setNotice]=useState('');
 useEffect(()=>{setSaved(readSaved()); const refresh=()=>setSaved(readSaved()); window.addEventListener('storage',refresh); return ()=>window.removeEventListener('storage',refresh);},[]);
 const toggle=(slug:string)=>{const current=readSaved(); const next=current.includes(slug)?current.filter(x=>x!==slug):[...current,slug];setSaved(next);try{localStorage.setItem(key,JSON.stringify(next));setNotice('');}catch{setNotice('Your browser could not save this shortlist. It will last for this visit only.');}};
 return {saved,toggle,notice};
}
export function ReviewBar({slug,index}: {slug:string;index:number}) {
 const {saved,toggle,notice}=useShortlist(); const [hidden,setHidden]=useState(false);
 if(hidden) return <button className="sb-show-review" onClick={()=>setHidden(false)}>Show variant controls</button>;
 return <aside className="sb-review" aria-label="Design review controls"><a href="/small-business">← All directions</a><span className="sb-review-title">{String(index+1).padStart(2,'0')} / 15 · {variants[index].name}</span><div><a href={pathFor(variants[(index+14)%15].slug)} aria-label="Previous variant">←</a><a href={pathFor(variants[(index+1)%15].slug)} aria-label="Next variant">→</a><button aria-pressed={saved.includes(slug)} onClick={()=>toggle(slug)}>{saved.includes(slug)?'★ Saved':'☆ Shortlist'}</button><button onClick={()=>setHidden(true)}>Hide controls</button></div>{notice && <p role="status">{notice}</p>}</aside>;
}
export function Gallery() {
 const {saved,toggle,notice}=useShortlist(); const [filter,setFilter]=useState('All');
 const shown=variants.filter(v=>filter==='All'||filter==='Shortlist'&&saved.includes(v.slug)||filter==='Business examples'&&['Shops & retail','Trades & repairs','Salons & appointments','Cafés & hospitality','Property & home services','Makers & creative studios','Small offices & services'].includes(v.audience)||filter==='General introductions'&&!['Shops & retail','Trades & repairs','Salons & appointments','Cafés & hospitality','Property & home services','Makers & creative studios','Small offices & services'].includes(v.audience));
 return <><div className="sb-gallery-controls"><div role="group" aria-label="Filter page variants">{['All','General introductions','Business examples','Shortlist'].map(label=><button key={label} aria-pressed={filter===label} onClick={()=>setFilter(label)}>{label}{label==='Shortlist'?` (${saved.length})`:''}</button>)}</div><span aria-live="polite">{shown.length} directions</span></div>{notice&&<p role="status">{notice}</p>}<div className="sb-gallery-grid">{shown.map(v=>{const index=variants.indexOf(v);return <article className={`sb-gallery-card sb-theme-${v.theme}`} key={v.slug}><a className={`sb-card-preview sb-preview-${v.layout}`} href={pathFor(v.slug)} aria-label={`View ${String(index+1).padStart(2,'0')}: ${v.name}`}><span className="sb-label">{v.audience}</span><h2>{v.title}</h2><Visual variant={v} small/></a><div className="sb-card-info"><div><span className="sb-label">{String(index+1).padStart(2,'0')} / {v.register}</span><h3><a href={pathFor(v.slug)}>{v.name} <span aria-hidden="true">↗</span></a></h3></div><button aria-label={`${saved.includes(v.slug)?'Remove':'Add'} ${v.name} ${saved.includes(v.slug)?'from':'to'} shortlist`} aria-pressed={saved.includes(v.slug)} onClick={()=>toggle(v.slug)}>{saved.includes(v.slug)?'★':'☆'}</button></div></article>;})}</div>{shown.length===0&&<div className="sb-empty"><h2>Your shortlist starts here.</h2><p>Use the star beside a direction to keep it in this browser.</p><button onClick={()=>setFilter('All')}>Browse all 15 directions →</button></div>}<p className="sb-storage-note">Your shortlist is saved in this browser only. Nothing is sent or submitted.</p></>;
}
