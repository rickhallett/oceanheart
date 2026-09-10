import type { Metadata } from "next";
import { ArrowIcon } from "../components/arrow-icon";
import { Footer, SiteNav } from "../components/editorial";
import "./studio.css";

export const metadata: Metadata = {
  title: "Oceanheart Studio — more room for the work",
  description:
    "A considered workspace for independent practitioners. Explore clients, bookings, enquiries and the shape of a working day in the Oceanheart Studio demo.",
  alternates: { canonical: "https://www.oceanheart.ai/studio" },
  openGraph: {
    title: "Oceanheart Studio — more room for the work",
    description:
      "The people, appointments and small decisions behind an independent practice. Brought together.",
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
const contactHref = "mailto:rick@oceanheart.ai?subject=Let%E2%80%99s%20talk%20about%20Studio";

function DemoButton({ children = "Explore the demo" }: { children?: React.ReactNode }) {
  return (
    <a className="studio-button" href={demoUrl}>
      {children}
      <ArrowIcon direction="right" />
    </a>
  );
}
function Screen({
  name,
  alt,
  caption,
  eager = false,
}: {
  name: string;
  alt: string;
  caption: string;
  eager?: boolean;
}) {
  return (
    <figure className="studio-screen">
      <a
        href={`/images/studio/precision-${name}.webp`}
        aria-label={`Open full-size ${name} screenshot`}
      >
        <img
          src={`/images/studio/precision-${name}.webp`}
          width="1440"
          height="1000"
          alt={alt}
          loading={eager ? "eager" : "lazy"}
        />
      </a>
      <figcaption>
        <span>{caption}</span>
        <span>Fictional demo data · View full size ↗</span>
      </figcaption>
    </figure>
  );
}

const capabilities = [
  [
    "Today",
    "A practical starting point",
    "See the day’s appointments and the tasks that need attention, then move straight into the work.",
  ],
  [
    "Clients",
    "Continuity between appointments",
    "Keep client records in the practice workspace, with the context needed to pick up the relationship again.",
  ],
  [
    "Services",
    "A clear offer",
    "Manage the services behind the practice so bookings have a consistent description, duration and price.",
  ],
  [
    "Bookings",
    "A week you can work with",
    "Create and manage appointments around the clients and services they belong to.",
  ],
  [
    "Tasks",
    "Small things, remembered",
    "Capture follow-ups, organise due dates and client links, and mark work complete.",
  ],
  [
    "Enquiries & settings",
    "The edges of the practice",
    "Track enquiries and configure the workspace. Production Gmail authorisation is still pending.",
  ],
];

export default function Page() {
  return (
    <main className="studio-page">
      <SiteNav />
      <div className="studio-product-nav">
        <a href="#top" className="studio-product-name">
          Studio<span>by Oceanheart</span>
        </a>
        <nav aria-label="Studio page">
          <a href="#workflow">How it works</a>
          <a href="#capabilities">Product</a>
          <a href="#roadmap">Roadmap</a>
          <a href={appUrl}>
            Open Studio <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>

      <section className="studio-opening" aria-labelledby="studio-title">
        <div className="studio-kicker">
          <span className="studio-dot" /> An independent practice, thoughtfully organised
        </div>
        <div className="studio-hero-grid">
          <h1 id="studio-title">
            More room
            <br />
            for <em>the work.</em>
          </h1>
          <div className="studio-hero-copy">
            <p>
              The people. The appointments. The things you meant to follow up. Studio brings the
              running of your practice into one considered workspace.
            </p>
            <div className="studio-actions">
              <DemoButton />
              <a className="studio-text-link" href="#workflow">
                Meet your working day <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="studio-small">
              Explore a fictional practice. No sign-in needed for the demo.
            </p>
          </div>
        </div>
        <div className="studio-hero-media">
          <div className="studio-window-label">
            <span>
              <span className="studio-dot" /> The practice, at a glance
            </span>
            <span>Precision interface / Today</span>
          </div>
          <Screen
            name="today"
            alt="Precision Studio Today screen showing Rick Hallett’s fictional demo practice, appointments and tasks"
            caption="01 / A clear place to begin"
            eager
          />
        </div>
        <p className="studio-demo-disclosure">
          Actual Studio screenshots, captured from the public browser demo. Names, appointments,
          balances and messages are fictional. Payment figures and assistant actions shown in the
          demo are simulations.
        </p>
      </section>

      <section className="studio-context studio-wrap" aria-labelledby="studio-context-title">
        <p className="studio-eyebrow">Built around a real kind of working life</p>
        <div className="studio-section-heading">
          <h2 id="studio-context-title">
            You run a practice.
            <br />
            And everything around it.
          </h2>
          <p>
            For independent therapists, coaches, bodyworkers and other practitioners whose work
            depends on attention, trust and continuity. Especially when the person doing the work is
            also the person running the business.
          </p>
        </div>
        <div className="studio-problems">
          <article>
            <span>01 / The scattered day</span>
            <h3>
              A calendar here.
              <br />A conversation there.
            </h3>
            <p>
              When appointments, client details and follow-ups live in different places, even a
              small decision starts with a search. Studio gives those pieces a shared home.
            </p>
          </article>
          <article>
            <span>02 / The invisible workload</span>
            <h3>
              The work between
              <br />
              the appointments.
            </h3>
            <p>
              Replying to an enquiry. Preparing for a session. Remembering a promise. These are part
              of a good practice, and they deserve a visible place in the day.
            </p>
          </article>
          <article>
            <span>03 / The growing practice</span>
            <h3>
              A system with room
              <br />
              to become yours.
            </h3>
            <p>
              A service changes. A client returns. The week takes a different shape. The ambition is
              a connected workspace that can grow with the practice.
            </p>
          </article>
        </div>
      </section>

      <section id="workflow" className="studio-workflow" aria-labelledby="studio-workflow-title">
        <div className="studio-wrap">
          <p className="studio-eyebrow">A working day, connected</p>
          <div className="studio-section-heading">
            <h2 id="studio-workflow-title">
              From a first hello
              <br />
              to what happens next.
            </h2>
            <p>
              Follow one relationship through the practice. Each screen gives the next decision a
              little more context.
            </p>
          </div>
          <div className="studio-journey" aria-label="Practice workflow">
            <span>01 Enquiry</span>
            <span>02 Client</span>
            <span>03 Booking</span>
            <span>04 Follow-up</span>
          </div>
          <article className="studio-feature">
            <div className="studio-feature-copy">
              <p className="studio-eyebrow">01 / Begin with the conversation</p>
              <h3>
                A first enquiry
                <br />
                deserves attention.
              </h3>
              <p>
                A prospective client arrives with a question, a hope, or a little uncertainty. Keep
                the enquiry visible while you decide what a helpful next step looks like.
              </p>
              <p>
                Studio’s enquiries area is part of the current application. The demo lets you
                explore sample conversations; a production Gmail connection is still awaiting OAuth
                authorisation.
              </p>
              <a className="studio-text-link" href="https://studio.oceanheart.ai/app/inbox?demo=1">
                Explore sample enquiries <ArrowIcon direction="right" />
              </a>
            </div>
            <Screen
              name="enquiries"
              alt="Precision Studio enquiries interface with fictional conversations"
              caption="02 / Enquiries, with context"
            />
          </article>
          <article className="studio-feature studio-feature-reverse">
            <div className="studio-feature-copy">
              <p className="studio-eyebrow">02 / Keep the person in view</p>
              <h3>
                A familiar place
                <br />
                for every client.
              </h3>
              <p>
                A client record gives the relationship a stable place in the workspace. Find the
                person you need, then move into their appointments and the work around them.
              </p>
              <p>
                Client management is connected to the everyday rhythm of the practice. A return
                visit should feel like continuing a conversation.
              </p>
              <a
                className="studio-text-link"
                href="https://studio.oceanheart.ai/app/clients?demo=1"
              >
                Meet the fictional practice <ArrowIcon direction="right" />
              </a>
            </div>
            <Screen
              name="clients"
              alt="Precision Studio client directory populated with fictional demo clients"
              caption="03 / The people behind the practice"
            />
          </article>
          <article className="studio-feature">
            <div className="studio-feature-copy">
              <p className="studio-eyebrow">03 / Give the week its shape</p>
              <h3>
                Make space for
                <br />
                the next appointment.
              </h3>
              <p>
                Bring the client, the service and the time together. A booking is easier to
                understand when it belongs to the same workspace as the rest of the practice.
              </p>
              <p>
                Move between the day’s overview and the calendar to see what is happening now and
                what is coming next.
              </p>
              <a
                className="studio-text-link"
                href="https://studio.oceanheart.ai/app/calendar?demo=1"
              >
                Explore the sample calendar <ArrowIcon direction="right" />
              </a>
            </div>
            <Screen
              name="bookings"
              alt="Precision Studio bookings calendar showing fictional appointments"
              caption="04 / A week with a little more shape"
            />
          </article>
          <div className="studio-followup">
            <div>
              <p className="studio-eyebrow">04 / Close the loop</p>
              <h3>
                Give a small promise
                <br />
                somewhere to live.
              </h3>
            </div>
            <div>
              <p>
                Capture the follow-up as a task. Set a due date, connect it to a client, and
                complete it when the work is done. Today brings that work back into view.
              </p>
              <a className="studio-text-link" href="https://studio.oceanheart.ai/app/tasks?demo=1">
                Explore tasks in the demo <ArrowIcon direction="right" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="studio-capabilities studio-wrap"
        aria-labelledby="studio-capabilities-title"
      >
        <p className="studio-eyebrow">The product today</p>
        <div className="studio-section-heading">
          <h2 id="studio-capabilities-title">
            A useful foundation.
            <br />
            An honest account of it.
          </h2>
          <p>
            Studio is in active development. The core practice workspace is available in the current
            release; the browser demo also explores ideas that go beyond that release.
          </p>
        </div>
        <div className="studio-release-label">
          <span className="studio-dot" /> Current application · signed-in workspace
        </div>
        <div className="studio-capability-grid">
          {capabilities.map(([name, title, body]) => (
            <article key={name}>
              <p className="studio-eyebrow">{name}</p>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="studio-status-grid">
          <article>
            <span className="studio-state-label">Explore / Browser demo</span>
            <h3>A practice you can walk through.</h3>
            <p>
              The public demo uses a fictional Rick Hallett practice. You can explore the interface
              without signing in. Sample balances, messages and assistant suggestions illustrate the
              intended experience; they are not evidence of live payments or email delivery.
            </p>
            <DemoButton />
          </article>
          <article>
            <span className="studio-state-label studio-state-pending">
              Pending / Connected services
            </span>
            <h3>Connections that still need to earn trust.</h3>
            <p>
              Production Gmail OAuth remains pending. Payment processing, website publishing, a live
              client portal and the broader assistant experience are roadmap work. Their presence in
              the demo navigation does not make them released integrations.
            </p>
            <a className="studio-text-link" href="#roadmap">
              See the direction of travel <ArrowIcon direction="right" />
            </a>
          </article>
        </div>
      </section>

      <section className="studio-principles" aria-labelledby="studio-principles-title">
        <div className="studio-wrap">
          <p className="studio-eyebrow">The thinking behind the product</p>
          <div className="studio-section-heading">
            <h2 id="studio-principles-title">
              Calm on the surface.
              <br />
              Care in the decisions.
            </h2>
            <p>
              Studio is a product and engineering project built around the realities of independent
              practice. Its quality depends on the small decisions that hold a working day together.
            </p>
          </div>
          <div className="studio-principle-list">
            <article>
              <span>01</span>
              <h3>Start with the daily work.</h3>
              <p>
                Clients, services, bookings and tasks form the foundation. Connected workflows come
                before adding more places to click.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Make the next step legible.</h3>
              <p>
                A consistent Precision interface gives each area a familiar structure. Clear
                hierarchy and generous space leave room for the content that matters.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Keep the boundary visible.</h3>
              <p>
                A fictional demo is a place to explore. The signed-in application is a separate
                context. The product story identifies which capabilities belong to each.
              </p>
            </article>
            <article>
              <span>04</span>
              <h3>Earn the connected future.</h3>
              <p>
                Email, payments and assistance introduce consequences beyond a screen. The roadmap
                treats them as product and operational responsibilities.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        id="roadmap"
        className="studio-roadmap studio-wrap"
        aria-labelledby="studio-roadmap-title"
      >
        <p className="studio-eyebrow">Where this can go</p>
        <div className="studio-section-heading">
          <h2 id="studio-roadmap-title">
            One practice.
            <br />A more connected future.
          </h2>
          <p>
            The long-term ambition is to connect the public face of a practice with the work behind
            it. This is a direction of travel, with scope shaped by what proves useful.
          </p>
        </div>
        <div className="studio-roadmap-grid">
          <article>
            <span className="studio-roadmap-stage">01 / Foundation · available</span>
            <h3>The working practice</h3>
            <p>
              Clients, services, bookings, tasks, Today, enquiries and settings in the current
              application.
            </p>
          </article>
          <article>
            <span className="studio-roadmap-stage">02 / Next · planned</span>
            <h3>The connected practice</h3>
            <p>
              Complete production Gmail authorisation, then develop reliable connections between
              conversations and the rest of the workspace.
            </p>
          </article>
          <article>
            <span className="studio-roadmap-stage">03 / Horizon · exploratory</span>
            <h3>The whole practice</h3>
            <p>
              Website publishing, a client portal, payments and thoughtful assistance. A coherent
              experience for the practitioner and the people they work with.
            </p>
          </article>
        </div>
        <p className="studio-small">
          Roadmap items are intentions, not release commitments. The demo may illustrate them before
          they are available in the live application.
        </p>
      </section>

      <section className="studio-closing">
        <div className="studio-wrap">
          <p className="studio-eyebrow">Step inside Studio</p>
          <h2>
            A working idea.
            <br />
            <em>Ready to explore.</em>
          </h2>
          <p>
            Take a look around the fictional practice. Follow an enquiry, explore the calendar, and
            see the shape of a day. Then tell Rick what would make it useful for yours.
          </p>
          <div className="studio-actions">
            <DemoButton />
            <a className="studio-text-link" href={contactHref}>
              Talk to Rick <ArrowIcon direction="right" />
            </a>
          </div>
          <div className="studio-closing-note">
            <span>Built by Rick Hallett · Oceanheart</span>
            <a href={appUrl}>Already have access? Open Studio ↗</a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
