import type { Metadata } from 'next';
import Link from '../components/site-link';
import { ArrowIcon } from '../components/arrow-icon';
import { Footer, SiteNav } from '../components/editorial';
import './studio.css';

export const metadata: Metadata = {
  title: 'Oceanheart Studio — a workspace for independent practitioners',
  description:
    'Studio is a workspace being built for independent practitioners, bringing enquiries, bookings, clients, services and tasks together. Currently in development.',
  alternates: { canonical: 'https://www.oceanheart.ai/studio' },
};

const demoUrl = 'https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app/app';
const contactHref = 'mailto:rick@oceanheart.ai?subject=Oceanheart%20Studio';

const working = [
  ['Enquiries', 'Conversations that become connections, with replies you approve.'],
  ['Bookings', 'A little shape to your week, with rescheduling that respects what is already there.'],
  ['Clients', 'The people behind your practice, with history in one place.'],
  ['Services', 'The work you offer, described once and reused everywhere.'],
  ['Tasks', 'A little less on your mind: titles and completion.'],
];

const next = [
  ['Website publishing', 'Edit your welcome and services, preview, then publish.'],
  ['Client portal', 'Let clients see their side of the practice.'],
  ['Payments', 'A clear picture of what is paid, tied to the work itself.'],
];

export default function Page() {
  return (
    <main className="studio-page">
      <SiteNav />
      <section className="studio-opening" aria-labelledby="studio-title">
        <p className="eyebrow">Oceanheart Studio · In development</p>
        <h1 id="studio-title">A little more room for the work.</h1>
        <p className="studio-intro">
          Studio is a workspace being built for independent practitioners. It brings enquiries,
          bookings, clients, services and tasks together in one quiet place, so the business
          of the practice takes up less of the day.
        </p>
        <div className="studio-actions">
          <a className="studio-button" href={demoUrl}>
            View the development demo <ArrowIcon direction="right" />
          </a>
          <a className="text-link" href={contactHref}>
            Talk to Rick about Studio <ArrowIcon direction="right" />
          </a>
        </div>
        <p className="studio-note">
          The demo runs with fictional sample data. Email and payments inside the demo are simulated.
        </p>
      </section>
      <section className="studio-media" aria-label="Development prototype screenshots">
        <figure className="studio-figure">
          <img
            src="/images/studio/today-prototype.png"
            alt="Prototype of the Studio workspace Today view, showing a sample practice day with fictional bookings and tasks"
            width="1440"
            height="1148"
            loading="eager"
          />
          <figcaption>Development prototype · fictional sample data</figcaption>
        </figure>
      </section>
      <section className="studio-columns" aria-label="What Studio covers">
        <div>
          <h2>Working development areas</h2>
          <p className="studio-note">
            These areas exist in the development demo and are being shaped with real practice needs.
          </p>
          <ul>
            {working.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Next to earn its place</h2>
          <p className="studio-note">
            Planned for the live workspace; some ideas appear in the demo.
          </p>
          <ul>
            {next.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="studio-media" aria-label="More prototype views">
        <figure className="studio-figure">
          <img
            src="/images/studio/calendar-prototype.png"
            alt="Prototype of the Studio Bookings view, showing a sample week with fictional client appointments"
            width="1440"
            height="900"
            loading="lazy"
          />
          <figcaption>Development prototype · fictional sample data</figcaption>
        </figure>
        <figure className="studio-figure">
          <img
            src="/images/studio/clients-prototype.png"
            alt="Prototype of the Studio Clients view, showing a fictional client list with session history"
            width="1440"
            height="900"
            loading="lazy"
          />
          <figcaption>Development prototype · fictional sample data</figcaption>
        </figure>
      </section>
      <section className="studio-status" aria-labelledby="studio-status-title">
        <h2 id="studio-status-title">Being built with practitioners</h2>
        <p>
          Studio is in active development. Explore the sample workspace, and talk to Rick
          about what would make it useful in your practice.
        </p>
        <div className="studio-actions">
          <a className="studio-button" href={demoUrl}>
            View the development demo <ArrowIcon direction="right" />
          </a>
          <a className="text-link" href={contactHref}>
            Talk to Rick about Studio <ArrowIcon direction="right" />
          </a>
        </div>
      </section>
      <Footer />
    </main>
  );
}
