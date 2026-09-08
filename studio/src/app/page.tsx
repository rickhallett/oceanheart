import { Leaf, MessageCircle, Heart, ArrowUpRight } from "lucide-react";
import { Mark, ButtonLink, TextLink, Eyebrow } from "@/components/ui";
import { PracticePreview } from "@/components/practice-preview";

const email =
  "mailto:rick@oceanheart.ai?subject=Let%E2%80%99s%20talk%20about%20Oceanheart%20Studio";
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="hero-scene">
        <header className="site-header">
          <a className="brand" href="#" aria-label="Oceanheart Studio home">
            <Mark />
            <span>Oceanheart Studio</span>
          </a>
          <p className="brand-description">
            Personal support for independent practitioners
          </p>
          <nav aria-label="Main navigation">
            <a href="#studio">The studio</a>
            <a href="#how-it-works">How it works</a>
            <a href="#contact">Get in touch</a>
          </nav>
        </header>
        <main id="main">
          <section className="hero container" aria-labelledby="hero-title">
            <div className="hero-copy">
              <h1 id="hero-title">
                Your practice,
                <br />
                beautifully put together.
              </h1>
              <p className="hero-description">
                A thoughtful home for your business.
                <br />
                Set up with you. Looked after with you.
              </p>
              <div className="hero-actions">
                <ButtonLink href="#contact">Let’s talk</ButtonLink>
                <TextLink href="#how-it-works">See how it works</TextLink>
              </div>
              <div className="hero-note">
                <span />
                <Eyebrow>More space for what matters</Eyebrow>
              </div>
            </div>
            <PracticePreview />
          </section>
        </main>
      </div>
      <section id="studio" className="studio-section section-border">
        <div className="container studio-grid">
          <div className="studio-intro">
            <Eyebrow>The studio</Eyebrow>
            <h2>
              Thoughtful support for the day-to-day realities of running a
              practice.
            </h2>
          </div>
          <div className="service">
            <Leaf />
            <h3>
              Your services, prices and
              <br className="desktop-break" /> booking details, clearly
              presented
            </h3>
          </div>
          <div className="service">
            <MessageCircle />
            <h3>
              Enquiries and bookings,
              <br /> in one place
            </h3>
          </div>
          <div className="service">
            <Heart />
            <h3>
              Ongoing support from
              <br /> a clinician and engineer
            </h3>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="process-section section-border">
        <div className="container">
          <div className="section-heading">
            <div>
              <h2>
                We put it together.
                <br />
                You make it your own.
              </h2>
            </div>
            <p>
              You bring your practice, however it looks today. We work through
              what you need, build a simpler way to run it, and keep helping as
              things change.
            </p>
          </div>
          <div className="steps">
            {[
              {
                title: "Start with a conversation",
                body: "Tell me about your work, your clients and the admin that keeps getting in the way. We’ll agree what would make the biggest difference.",
              },
              {
                title: "Give everything a place",
                body: "We bring your services, enquiries and booking process together. You get a clear website and a workspace organised around your day.",
              },
              {
                title: "Have someone in your corner",
                body: "We get you comfortable using it, then stay in touch. When something needs changing or stops making sense, you have someone to turn to.",
              },
            ].map((step, i) => (
              <article className="step" key={step.title}>
                <span className="step-number">0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="personal-section section-border">
        <div className="container personal-grid">
          <div className="personal-symbol">
            <Mark />
            <span>
              Built with care.
              <br />
              Looked after personally.
            </span>
          </div>
          <div>
            <h2>
              Hello, I’m Rick.
              <br />A clinician who builds things.
            </h2>
            <p>
              I’m a clinician and an engineer. Oceanheart Studio brings those
              two parts of my work together: understanding the care you put into
              your practice, and making the practical side easier to manage.
            </p>
            <p>
              We’ll work together directly, from the first conversation to the
              everyday questions that come after.
            </p>
            <TextLink href="#contact">Tell me about your practice</TextLink>
          </div>
        </div>
      </section>
      <section id="contact" className="contact-section section-border">
        <div className="container contact-inner">
          <h2>
            A little more space
            <br />
            for the work you love.
          </h2>
          <p>
            Tell me what you do, and what you wish took less of your time.
            <br />
            We can work out the next step together.
          </p>
          <ButtonLink href={email}>Let’s talk</ButtonLink>
          <a className="email-link" href={email}>
            rick@oceanheart.ai <ArrowUpRight size={14} />
          </a>
        </div>
      </section>
      <footer className="site-footer container">
        <a className="brand" href="#">
          <Mark />
          <span>Oceanheart Studio</span>
        </a>
        <p>Your practice, beautifully put together.</p>
        <a
          href="https://oceanheart.ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          Part of Oceanheart <ArrowUpRight size={13} />
        </a>
        <small>© {new Date().getFullYear()} Oceanheart</small>
      </footer>
    </>
  );
}
