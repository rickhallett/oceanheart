
import { ArrowIcon } from '@/app/components/arrow-icon';
import { CardArt } from './components/card-art';
import Link from '@/app/components/site-link';
import { Booking, Footer, SiteNav } from './components/editorial';

export default function Home() {
  return (
    <main className="oceanheart-home">
      <section className="landing-hero" aria-labelledby="landing-title">
        <SiteNav />

        <div className="landing-hero-content">
          <div className="landing-copy">
            <p className="eyebrow">Therapy · Design · Engineering</p>
            <h1 id="landing-title">Stay<br />human.</h1>
            <span className="human-rule" aria-hidden="true" />
          </div>
          <div className="landing-aside">
            <p className="landing-thought">Work with<br /> what is coming.</p>
            <p className="founder-line">I’m Rick Hallett, a therapist, experience designer and software engineer. I offer therapeutic sessions, help people work thoughtfully with AI, and build websites, tools and workflows around their needs.</p>
            <a className="text-link" href="#work">Explore ways to work together <ArrowIcon direction="right" /></a>
          </div>
        </div>
      </section>

      <div className="horizon-interlude"><CardArt kind="horizon" /><p>Space to see what comes next.</p></div>

      <section className="practice-index" id="work" aria-labelledby="practice-title">
        <div className="practice-intro">
          <p className="eyebrow">Three ways in</p>
          <h2 id="practice-title">What would you like help with?</h2>
        </div>

        <div className="practice-list">
          <Link className="practice-item" href="/conversations-with-ai">
            <span className="practice-number">01</span>
            <span>
              <small>Conversations with AI · Free pilot</small>
              <strong>Practical AI guidance</strong>
              <span className="practice-description">Bring a question, a task or an idea. We’ll explore how AI can help, where it falls short, and how to keep your own judgement involved.</span>
              <span className="practice-read">Explore Conversations with AI <span aria-hidden="true"><ArrowIcon /></span></span>
            </span>
          </Link>

          <Link className="practice-item" id="systems" href="/systems-work">
            <span className="practice-number">02</span>
            <span>
              <small>Design &amp; engineering</small>
              <strong>Websites, software &amp; workflows</strong>
              <span className="practice-description">Turn a difficult workflow or an idea into something you can use. I build websites, bespoke tools and AI integrations around the people using them.</span>
              <span className="practice-read">See what we could build <span aria-hidden="true"><ArrowIcon /></span></span>
            </span>
          </Link>

          <Link className="practice-item" id="human" href="/human-work">
            <span className="practice-number">03</span>
            <span>
              <small>Therapeutic practice</small>
              <strong>Therapy, bodywork &amp; massage</strong>
              <span className="practice-description">Space to talk, work with the body, or explore what feels difficult. Therapeutic sessions draw on a range of practices; massage can also be booked on its own.</span>
              <span className="practice-read">Explore therapeutic sessions <span aria-hidden="true"><ArrowIcon /></span></span>
            </span>
          </Link>
        </div>

        <div className="connected-practices"><CardArt kind="currents" />
          <h2>One person. Connected practices.</h2>
          <p>Therapy shapes how I listen. Design helps me understand what people need. Engineering gives me the means to build something useful. You can work with me in any one of these areas; each benefits from the others.</p>
          <Link href="/about" className="text-link">A little about Rick <span aria-hidden="true"><ArrowIcon /></span></Link>
        </div>
      </section>
      <Booking invitation="Not sure where to begin?" />
      <Footer />
    </main>
  );
}
