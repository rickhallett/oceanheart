import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Studio artwork studies', robots: { index: false, follow: false } };
const names = ['Image only', 'Title above', 'Caption below', 'Text alongside', 'Split title', 'Opposite corners'];
export default function ArtworkStudies() {
 return <main style={{maxWidth:1400,margin:'0 auto',padding:'48px 24px',color:'#17212f',background:'#ffffff'}}>
 <a href="/studio/possibilities">Back to Studio + Oceanheart</a>
 <h1 style={{fontSize:40,margin:'32px 0'}}>Six artwork studies</h1>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%, 420px),1fr))',gap:48}}>
 {names.map((name,i)=><figure key={name} style={{margin:0}}><a href={`/images/studio-possibilities/hero-study-${i+1}.png`}><img src={`/images/studio-possibilities/hero-study-${i+1}.png`} alt={`${name}: hand holding an intricate building with cyan and gold flame effects`} width={1024} height={1024} style={{width:'100%',height:'auto'}} /></a><figcaption style={{fontSize:20,marginTop:16}}>{i+1}. {name}</figcaption></figure>)}
 </div></main>;
}
