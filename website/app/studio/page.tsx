import type { Metadata } from "next";
import { Footer, SiteNav } from "../components/editorial";
import { ProductExplorer } from "./product-explorer";
import "./studio.css";

export const metadata: Metadata = {
  title: "Oceanheart Studio — your practice, in working order",
  description:
    "A workspace for independent practitioners. Bring clients, services, appointments and follow-ups together, and explore the real Studio interface in a fictional practice demo.",
  alternates: { canonical: "https://www.oceanheart.ai/studio" },
  openGraph: {
    title: "Oceanheart Studio — your practice, in working order",
    description:
      "Clients, appointments and the work between them. A considered workspace for independent practice.",
    url: "https://www.oceanheart.ai/studio",
    images: [
      {
        url: "/images/studio/precision-today.webp",
        width: 1440,
        height: 1000,
        alt: "Oceanheart Studio Today, with fictional demo practice data",
      },
    ],
  },
};
const demoUrl = "https://studio.oceanheart.ai/app?demo=1";
const appUrl = "https://studio.oceanheart.ai/app";
const contact = "mailto:rick@oceanheart.ai?subject=Let%E2%80%99s%20talk%20about%20Studio";

export default function Page() {
  return (
    <main id="top" className="studio-page">
      <SiteNav />
      <nav className="studio-product-nav" aria-label="Studio page">
        <a href="#top" className="studio-product-name">
          Studio
        </a>
        <div>
          <a href="#product">Explore</a>
          <a href="#working-day">A working day</a>
          <a href="#direction">What’s next</a>
          <a href={appUrl}>Studio sign-in</a>
        </div>
      </nav>

      <section className="studio-hero studio-wide" aria-labelledby="studio-title">
        <h1 id="studio-title">
          Your practice,
          <br />
          <span>in working order.</span>
        </h1>
        <p className="studio-lead">
          A place for the people you work with, the appointments you make, and the things you need
          to follow up.
        </p>
        <div className="studio-actions">
          <a className="studio-button" href={demoUrl}>
            Explore the demo
          </a>
          <a className="studio-link" href={contact}>
            Talk to Rick
          </a>
        </div>
        <p className="studio-hero-context">
          Studio is being built for independent practitioners. The public demo opens a fictional
          Rick Hallett practice without a sign-in.
        </p>
        <figure className="studio-hero-screen">
          <picture>
            <source
              media="(max-width: 600px)"
              srcSet="/images/studio/precision-today-mobile.webp"
              width="390"
              height="900"
            />
            <img
              src="/images/studio/precision-today.webp"
              width="1440"
              height="1000"
              alt="Studio Today showing fictional appointments, tasks and practice activity"
              loading="eager"
            />
          </picture>
          <figcaption>
            This is the actual Precision interface. Demo names, appointments, messages and balances
            are fictional. Payment figures and assistant actions shown here are simulated.
          </figcaption>
        </figure>
      </section>

      <section
        className="studio-introduction studio-wide"
        aria-labelledby="studio-introduction-title"
      >
        <h2 id="studio-introduction-title">
          For the person doing the work.
          <br />
          And running the practice.
        </h2>
        <div className="studio-reading studio-reading-offset">
          <p>
            An independent practice has a lot happening around each appointment. A new enquiry needs
            a reply. A returning client needs a time. A service has changed, and there is something
            you promised to follow up.
          </p>
          <p>
            When those pieces live across a calendar, an inbox and a collection of notes, the day
            begins with finding the work. Studio’s purpose is to give them a shared home.
          </p>
          <p>
            It is designed for independent therapists, coaches, bodyworkers and other practitioners
            whose work depends on attention and continuity. The ambition is a useful system for a
            small practice, with room to grow as the work changes.
          </p>
        </div>
      </section>

      <section
        id="product"
        className="studio-product studio-wide"
        aria-labelledby="studio-product-title"
      >
        <h2 id="studio-product-title">Look around the workspace.</h2>
        <p className="studio-reading">
          Choose a view to see how the practice fits together. These screenshots come from the
          browser demo; the links beneath them open the same area for you to explore.
        </p>
        <ProductExplorer />
      </section>

      <section
        id="working-day"
        className="studio-working-day studio-wide"
        aria-labelledby="studio-working-day-title"
      >
        <div className="studio-story-heading">
          <h2 id="studio-working-day-title">
            An enquiry becomes an appointment.
            <br />
            The relationship continues.
          </h2>
          <p>Follow the work through Studio.</p>
        </div>
        <ol className="studio-story">
          <li>
            <h3>Start with the conversation.</h3>
            <p>
              A prospective client arrives with a question, a hope, or a little uncertainty. Keep
              the enquiry visible while you decide what comes next. Enquiry management exists in the
              current application; connecting a production Gmail account still requires OAuth
              authorisation.
            </p>
          </li>
          <li>
            <h3>Make the appointment around the person.</h3>
            <p>
              A client record gives the relationship a stable place. Services describe the work you
              offer, including duration and price. A booking brings that client, service and time
              together, so an appointment belongs to the same workspace as the rest of the practice.
            </p>
          </li>
          <li>
            <h3>Remember what follows.</h3>
            <p>
              Capture a task, give it a due date, and connect it to a client. Complete it when the
              work is done. Today brings appointments and tasks back into view, so the small
              commitments between sessions remain part of the working day.
            </p>
          </li>
        </ol>
        <div className="studio-detail-note">
          <h3>Services and settings keep the foundation consistent.</h3>
          <p>
            Manage the offer behind the bookings and configure the practice workspace. Together with
            clients, enquiries, bookings, tasks and Today, these form the current signed-in
            application.
          </p>
          <a className="studio-link" href={appUrl}>
            Studio sign-in
          </a>
        </div>
      </section>

      <section className="studio-release studio-wide" aria-labelledby="studio-release-title">
        <h2 id="studio-release-title">
          What you can use.
          <br />
          What you can explore.
        </h2>
        <dl className="studio-release-list">
          <div>
            <dt>The current application</dt>
            <dd>
              Clients, services, bookings, tasks, Today, enquiries and settings are part of the
              implemented practice workspace, with core workflows verified in staging. Production
              sign-in setup and the first account acceptance check are still pending. You can
              explore the public demo now; account access at{" "}
              <a href={appUrl}>studio.oceanheart.ai/app</a> is still being prepared.
            </dd>
          </div>
          <div>
            <dt>The public browser demo</dt>
            <dd>
              A fictional practice lets you explore the product without an account. Its balances,
              messages and assistant suggestions illustrate the experience. They are not evidence of
              payment processing or email delivery.
            </dd>
          </div>
          <div>
            <dt>Connected services</dt>
            <dd>
              Production Gmail OAuth remains pending. Payment processing, website publishing, a live
              client portal and the broader assistant experience are planned capabilities. Their
              presence in the demo navigation does not mean they are released integrations.
            </dd>
          </div>
        </dl>
      </section>

      <section
        id="direction"
        className="studio-direction studio-wide"
        aria-labelledby="studio-direction-title"
      >
        <h2 id="studio-direction-title">
          Build the daily work well.
          <br />
          <span>Then connect the rest.</span>
        </h2>
        <div className="studio-direction-prose studio-reading">
          <p>
            Studio is a product and engineering project by Rick Hallett, shaped around independent
            practice. The first responsibility is to make the core workflow coherent: people,
            services, appointments and follow-ups should belong to the same working picture.
          </p>
          <p>
            The Precision interface follows that idea. A continuous white surface, familiar controls
            and restrained blue actions keep attention on the work. Information should remain
            readable as the practice moves between a desktop and a phone.
          </p>
          <h3>The next connection is email.</h3>
          <p>
            Completing production Gmail authorisation is the next step toward connecting
            conversations with the practice workspace. A useful integration needs reliable behaviour
            and clear responsibility for what happens outside the app.
          </p>
          <h3>The longer view is the whole practice.</h3>
          <p>
            A public website that reflects your services. A portal where clients can see their side
            of the practice. Payments connected to the work itself. Assistance that helps with the
            administrative load.
          </p>
          <p>
            These remain roadmap intentions, with scope shaped by what proves useful. The demo can
            illustrate them before they are ready for the live application. The aim is a connected
            experience that earns its place in a practitioner’s day.
          </p>
        </div>
      </section>

      <section className="studio-closing studio-wide" aria-labelledby="studio-closing-title">
        <h2 id="studio-closing-title">
          Spend a little time
          <br />
          in the practice.
        </h2>
        <p>
          Explore the fictional workspace, follow an enquiry, and look at the week ahead. If you can
          see a place for Studio in your work, Rick would like to hear what matters to you.
        </p>
        <div className="studio-actions">
          <a className="studio-button" href={demoUrl}>
            Explore the demo
          </a>
          <a className="studio-link" href={contact}>
            Talk to Rick about Studio
          </a>
        </div>
      </section>
      <Footer />
    </main>
  );
}
