import type { Variant } from './content';
const captions: Record<string,string> = {
 'high-street':'A little practical help for the businesses that make a place.',
 'closing':'Make a little more room at the end of the day.',
 'worktable':'Your work on the table. Someone beside you to help.',
 'portrait':'Rick Hallett · Practical AI guidance',
};
export function Visual({ variant: v, small = false }: { variant: Variant; small?: boolean }) {
 if (['high-street','closing','worktable','portrait'].includes(v.art)) return <figure className={`sb-art sb-art-${v.art}`}>
  <img src={v.art === 'portrait' ? '/images/kai-outdoors.jpeg' : `/images/small-business/${v.art}.webp`} alt={v.art === 'portrait' ? 'Rick Hallett outdoors' : v.art === 'high-street' ? 'Editorial illustration of independent shops on a British high street' : v.art === 'worktable' ? 'Illustration of two people working together at a table with notes and a laptop' : 'Evening illustration of a closed notebook, keys, cup and flower in window light'} width={1536} height={1024} loading={small ? 'lazy' : 'eager'} />
  {!small && <figcaption>{captions[v.art]}</figcaption>}
 </figure>;
 if(v.art === 'quote') return <div className="sb-quote-visual" aria-label="Illustrative journey from job notes to a checked quote">
  <div className="sb-note"><span className="sb-label">01 / Your notes</span><p>Replace garden gate.<br/>Keep existing posts.<br/>Customer to choose finish.</p><span className="sb-hand">The detail you already know.</span></div>
  <div className="sb-quote"><span className="sb-label">02 / Draft for review</span><h3>Garden gate replacement</h3><dl><dt>Scope</dt><dd>Replace gate; retain posts</dd><dt>Finish</dt><dd>Awaiting customer choice</dd><dt>Price</dt><dd>Add your agreed rates</dd></dl><span className="sb-check">Your approval comes next ↗</span></div>
  {!small && <p className="sb-caption">Illustrative example. AI organises the draft; you confirm the job.</p>}
 </div>;
 if(v.art === 'conversation') return <div className="sb-chat" aria-label="Example coaching conversation"><span className="sb-label">A familiar moment</span><p className="sb-bubble">“People keep asking the same things. I type the answers out every time.”</p><p className="sb-bubble sb-reply">Let’s take one of those questions and write a reply that sounds like you.</p><p className="sb-bubble">“Can I change it before it goes?”</p><p className="sb-bubble sb-reply">Yes. You check it, edit it and decide when to send.</p></div>;
 if(v.art === 'enquiry') return <div className="sb-enquiry"><div className="sb-inputs"><span>Email enquiry</span><span>Website message</span><span>Telephone notes</span></div><div className="sb-connector" aria-hidden="true">↓</div><div className="sb-enquiry-card"><span className="sb-label">Example / Details to check</span><h3>One clear next step.</h3><p>What’s needed?<br/>Where and when?<br/>What do we still need to ask?</p><div className="sb-check">A person reviews the reply ↗</div></div></div>;
 if(v.art === 'questions') return <div className="sb-question-art" aria-label="Questions we can work through"><span className="sb-question-mark" aria-hidden="true">?</span><div><p>Will it help?</p><p>Can I trust it?</p><p>Can I afford it?</p><p>Can I learn it?</p></div></div>;
 if(v.art === 'documents') return <div className="sb-document-visual"><span className="sb-label">An example, using familiar files</span><div className="sb-file-row"><span>Document</span><span aria-hidden="true">↘</span></div><div className="sb-file-row"><span>Spreadsheet</span><span aria-hidden="true">→</span></div><div className="sb-file-row"><span>Email notes</span><span aria-hidden="true">↗</span></div><div className="sb-document-result"><span className="sb-label">Your next step</span><h3>A summary<br/>you can check.</h3><p>Source material stays the reference.</p></div></div>;
 return <div className="sb-journey-art"><span className="sb-label">Example / Preparing a quote</span>{[['01','Your knowledge','Job notes, scope and rates'],['02','AI helps you draft','Organise the details'],['03','You check the result','Correct, approve, send']].map(([n,t,d])=><div key={n}><span>{n}</span><section><h3>{t}</h3><p>{d}</p></section></div>)}</div>;
}
