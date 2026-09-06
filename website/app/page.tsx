import { ArrowIcon } from './components/arrow-icon';
import { CardArt } from './components/card-art';
import Link from './components/site-link';
import { Booking, Footer, SiteNav } from './components/editorial';
export default function Home() {
 return <main className="oceanheart-home integrated-home">
  <section className="landing-hero heart-home-hero" aria-labelledby="landing-title"><div className="home-heart-art"><CardArt kind="heart" /></div><SiteNav />
   <div className="landing-hero-content">
    <div className="landing-copy"><p className="eyebrow">The Way of the Ocean Hearted</p><h1 id="landing-title">Stay<br />human.</h1><span className="human-rule" aria-hidden="true" /></div>
    <div className="landing-aside"><p className="landing-thought">Make room for yourself in a world that asks a lot.</p><p className="founder-line">The machine is coming, we all feel it. The question is, what do we do about it? How do we stay well?</p><p className="founder-line">I work with conversation, breath and the body, shaping each session with you around your lived experience.</p><a className="text-link" href="#work">Explore the practice <ArrowIcon direction="right" /></a></div>
   </div>
  </section>
  <section className="practice-index" id="work" aria-labelledby="practice-title">
   <div className="practice-intro"><p className="eyebrow">The thread through the work</p><h2 id="practice-title">How are you with what’s happening?</h2></div>
   <div className="integrated-intro"><p>You might be caught in a familiar story about yourself, overwhelmed by a feeling, or aware of tension you can’t quite put into words. We begin with how that experience is showing up for you, here and now.</p><p>My interest is in whether you feel confined within it, or have some room to notice, breathe, feel and choose. That question guides the work as we move between conversation and attention to the body.</p></div>
   <div className="practice-list">
    <Link className="practice-item" href="/practice"><span className="practice-number">01</span><span><small>One practice, several ways of working</small><strong>Following your experience</strong><span className="practice-description">ACT, breathwork, somatic inquiry and hands-on work offer different ways into the same exploration. We choose together what belongs in your session.</span><span className="practice-read">How I work <ArrowIcon /></span></span></Link>
    <Link className="practice-item" href="/sessions"><span className="practice-number">02</span><span><small>Working together</small><strong>An invitation, at every step</strong><span className="practice-description">You can lean into an experience, slow down, change direction or decline an invitation. We make time to step back and understand what we’re doing together.</span><span className="practice-read">What a session can be like <ArrowIcon /></span></span></Link>
    <Link className="practice-item" href="/events"><span className="practice-number">03</span><span><small>Swanage · Poole · Bournemouth</small><strong>Practising in company</strong><span className="practice-description">Space for meditation, breathwork and somatic movement classes. Dates and venues will be shared here when confirmed.</span><span className="practice-read">Events & classes <ArrowIcon /></span></span></Link>
   </div>
   <div className="connected-practices"><CardArt kind="currents" /><h2>A life of inquiry. A practice with people.</h2><p>I’m Rick. My background is in psychology and CBT, alongside a longstanding contemplative practice. My own inquiry into identity, experience and freedom continues to shape how I work.</p><p>You may have valued therapy and be curious about working more with the body. Or you may be looking for a different way in, with someone whose background includes NHS and private therapeutic practice.</p><Link href="/about" className="text-link">Meet Rick <ArrowIcon /></Link></div>
  </section>
  <Booking invitation="Make room for yourself in a world that asks a lot." description="Start with a free, short conversation about what you’re looking for and whether this way of working feels right for you." /><Footer />
 </main>;
}
