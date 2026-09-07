import { SiteNav, Footer } from '../components/editorial';
import { ArrowIcon } from '../components/arrow-icon';
import { bookingLink } from '../../lib/bookings';
import { commonFaq, pathFor, variants, type Variant } from './content';
import { Visual } from './visuals';
import { ReviewBar } from './review';
function CTA({ v, secondary = false }: { v: Variant; secondary?: boolean }) {
 return <a className={'sb-button' + (secondary ? ' sb-button-secondary' : '')} href={bookingLink('digital').href}>{v.cta}<span aria-hidden="true"><ArrowIcon /></span></a>;
}
function Tasks({v}: {v: Variant}) { return <section className="sb-tasks" id="possibilities"><div className="sb-section-heading"><p className="sb-label">A few places we could begin</p><h2>{v.question}</h2></div><div className="sb-task-list">{v.tasks.map(([title,text],i)=><article key={title}><span className="sb-count">0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>; }
function Process({v}: {v: Variant}) { return <section className="sb-process"><p className="sb-label">How we might work together</p><div className="sb-process-track">{v.example.map((text,i)=><div key={text}><span>0{i+1}</span><h3>{text}</h3>{i<2 && <b aria-hidden="true"><ArrowIcon direction="right" /></b>}</div>)}</div><p className="sb-process-note">We choose a suitable task and agree the session, cost and materials before paid work starts.</p></section>; }
function FAQ({v}: {v: Variant}) {return <section className="sb-faq" id="questions"><div><p className="sb-label">Before we begin</p><h2>Good questions.</h2></div><div>{[...v.faq,...commonFaq].map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>;}
export default function VariantPage({v, official = false}: {v:Variant; official?: boolean}) {
 const index = variants.findIndex(item => item.slug === v.slug);
 return <main id="main-content" className={`sb-page sb-theme-${v.theme} sb-layout-${v.layout}${official ? ' sb-official' : ''}`}>
  <a className="sb-skip" href="#possibilities">Skip to the details</a>
  {!official && <ReviewBar slug={v.slug} index={index}/>}
  {official ? <SiteNav /> : <header className="sb-header"><a className="sb-wordmark" href="/">oceanheart.ai</a><nav aria-label="Page navigation"><a href="#possibilities">What we could do</a><a href="#questions">Questions</a><a href="#conversation">Let’s talk <span aria-hidden="true"><ArrowIcon /></span></a></nav></header>}
  <section className="sb-hero"><div className="sb-hero-copy"><p className="sb-label">{v.kicker}</p><h1>{v.title}</h1><p className="sb-intro">{v.intro}</p><CTA v={v}/><p className="sb-small">Free first conversation · Paid work agreed in advance</p></div><div className="sb-hero-visual"><Visual variant={v}/></div>{v.layout==='menu' && <div className="sb-menu-foot"><span>Today’s possibility</span><span>A little less admin.</span></div>}</section>
  {v.layout==='questions' ? <><FAQ v={v}/><Tasks v={v}/><Process v={v}/></> : v.layout==='steps' || v.layout==='journey' ? <><Process v={v}/><Tasks v={v}/><FAQ v={v}/></> : <><Tasks v={v}/><Process v={v}/><FAQ v={v}/></>}
  <section className="sb-takeaway"><p className="sb-label">What you take away</p><h2>{v.takeaway}</h2><p>Practical guidance from Rick Hallett. We use your business knowledge, available tools and a task that matters to you.</p><a href="https://dev.oceanheart.ai/selected-work" className="sb-text-link">See my technical work <span aria-hidden="true"><ArrowIcon /></span></a></section>
  <section className="sb-contact" id="conversation"><p className="sb-label">A useful next step</p><h2>{v.layout==='letter' ? 'Tell me what you’re working on.' : 'Let’s start with your work.'}</h2><p>Tell me what you do, what takes time and what you’d like to make easier. We can work out whether there’s something worth trying.</p><CTA v={v}/><a className="sb-email" href={`mailto:rick@oceanheart.ai?subject=${encodeURIComponent('Practical AI help — '+v.audience)}`}>Or email rick@oceanheart.ai</a></section>
  {official ? <Footer /> : <footer className="sb-footer"><a href="/" className="sb-wordmark">oceanheart.ai</a><span>Rick Hallett · Practical AI guidance</span><a href="https://dev.oceanheart.ai/">Design, engineering & AI <ArrowIcon /></a></footer>}
  {!official && <nav className="sb-bottom-review" aria-label="Explore other page variants"><a href={pathFor(variants[(index+14)%15].slug)}><ArrowIcon direction="left" /> Previous</a><a href="/small-business">All 15 directions</a><a href={pathFor(variants[(index+1)%15].slug)}>Next <ArrowIcon direction="right" /></a></nav>}
 </main>;
}
