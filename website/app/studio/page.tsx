import type { Metadata } from "next";
import { Footer, SiteNav } from "../components/editorial";
import { ProductExplorer } from "./product-explorer";
import "./studio.css";

export const metadata: Metadata = {
  title: "Oceanheart Studio — practice software shaped around your work",
  description:
    "Practice management for independent practitioners, with direct collaboration to shape useful workflows, integrations and client experiences. Explore the public demo.",
  alternates: { canonical: "https://www.oceanheart.ai/studio" },
  openGraph: {
    title: "Oceanheart Studio — practice software shaped around your work",
    description:
      "A shared practice-management foundation and direct collaboration to make the working day more manageable.",
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
          <a href="#direction">Working together</a>
          <a href={appUrl}>Studio sign-in</a>
        </div>
      </nav>

      <section className="studio-hero studio-wide" aria-labelledby="studio-title">
        <h1 id="studio-title">
          Practice software
          <br />
          <span>shaped around the way you work.</span>
        </h1>
        <p className="studio-lead">
          Bring enquiries, appointments and follow-ups into one place. Work directly with the maker
          to shape the parts that matter to your practice.
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
          Studio is being developed as a maintained practice-management product for independent
          practitioners and small practices. Explore the fictional demo without signing in.
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
            A new enquiry needs a reply. An appointment changes. Someone is waiting to hear what
            happens next. When the details are spread across inboxes, calendars and notes, keeping
            the practice moving becomes another job.
          </p>
          <p>
            Studio’s purpose is less fragmented admin, fewer dropped enquiries and clearer handoffs.
            A place to see what needs attention and keep the thread of a client relationship, so the
            working day feels more manageable.
          </p>
          <p>
            The approach combines a shared product with direct collaboration. For independent
            therapists, coaches, bodyworkers and small practices, that means a route to discuss the
            workflows, integrations and client experiences that need a better fit. Each proposed
            change starts with understanding the work and agreeing a useful, maintainable scope.
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
          <h3>A shared foundation, with room to adapt.</h3>
          <p>
            Clients, services, bookings, tasks, Today, enquiries and settings form the current
            foundation. An intake process, booking rule or client-facing form could be an area for
            collaboration. These are examples to explore together, not ready-made features or a
            promise that every request can be supported.
          </p>
          <a className="studio-link" href={appUrl}>
            Studio sign-in
          </a>
        </div>
      </section>

      <section className="studio-release studio-wide" aria-labelledby="studio-release-title">
        <h2 id="studio-release-title">
          Where Studio stands.
          <br />
          What comes next.
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
          Your work shapes the change.
          <br />
          <span>We follow it through.</span>
        </h2>
        <div className="studio-direction-prose studio-reading">
          <p>
            Work directly with Rick Hallett, who brings clinical experience, hands-on engineering
            and customer-facing delivery. That background helps connect the human context of a
            practice with the decisions needed to build useful software. Understanding your
            particular practice still starts with listening, rather than assuming it works like
            someone else’s.
          </p>
          <p>
            Show a recent awkward enquiry, booking or handoff, including the tools and workarounds
            around it. Together, identify what would make it better and agree a useful change. The
            answer might be a setting, a shared product improvement or a scoped adaptation.
          </p>
          <h3>Build with feedback. Check the whole journey.</h3>
          <p>
            Use real working examples and early versions to shape the result. Before calling it
            finished, verify the intended journey in its working environment and check that you can
            use it. Agree how the change will be maintained, its dependencies and the support it
            needs through future updates.
          </p>
          <h3>Responsive development, with clear responsibility.</h3>
          <p>
            AI development tools help Rick investigate problems, explore alternatives and build
            improvements. Responsibility for the result stays with Oceanheart. You do not need to
            adopt AI in your client relationships to benefit from this way of developing software.
          </p>
          <p>
            The ambition is a dependable common foundation that can adapt where it matters: enquiry
            journeys, communications, booking arrangements and the experience clients see. Each
            opportunity needs its own scope and maintenance agreement. Useful lessons can improve
            the shared product while preserving differences that serve a practice well.
          </p>
        </div>
      </section>

      <section className="studio-closing studio-wide" aria-labelledby="studio-closing-title">
        <h2 id="studio-closing-title">
          What gets in the way
          <br />
          of your working day?
        </h2>
        <p>
          Explore the demo, then bring a recurring difficulty to a conversation with Rick. An
          enquiry that loses its thread, a booking that takes too many steps, a handoff that depends
          on memory. Start with the work you would like to make easier.
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
