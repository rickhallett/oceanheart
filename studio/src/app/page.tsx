import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Mark } from "@/components/ui";
import { StudioProvider } from "@/components/studio-provider";
import "./precision-home.css";

export const metadata: Metadata = {
  title: "oceanheart Studio — Your practice, in one place",
  description:
    "A clear workspace for your enquiries, clients, bookings and follow-ups. Practice software shaped around the way you work.",
  openGraph: {
    title: "oceanheart Studio — Your practice, in one place",
    description: "Practice software shaped around the way you work.",
    images: ["/precision-today.webp"],
  },
};

export default function Home() {
  return (
    <StudioProvider application>
      <div className="precision-home">
        <a className="ph-skip" href="#main">
          Skip to content
        </a>
        <header className="ph-header">
          <a className="ph-brand" href="/" aria-label="oceanheart Studio home">
            <Mark />
            <span>
              oceanheart <strong>Studio</strong>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a href="https://www.oceanheart.ai/studio">
              About Studio <ArrowUpRight size={14} />
            </a>
            <a href="/app">
              Open Studio <ArrowRight size={15} />
            </a>
          </nav>
        </header>
        <main id="main" tabIndex={-1}>
          <section className="ph-intro" aria-labelledby="hero-title">
            <div>
              <h1 id="hero-title">
                Your practice,
                <br />
                in one place.
              </h1>
              <p>
                A clear home for the work around your work. Bring enquiries,
                clients, bookings and follow-ups together, with room to make it
                your own.
              </p>
              <div className="ph-actions">
                <a className="ph-primary" href="/app">
                  Open Studio <ArrowRight size={17} />
                </a>
                <a href="/app?demo=1">
                  Explore the demo <ArrowRight size={17} />
                </a>
              </div>
            </div>
            <p className="ph-aside">
              Built for independent practitioners.
              <br />
              Shaped through real conversations,
              <br />
              and the everyday details that matter.
            </p>
          </section>
          <figure className="ph-preview">
            <a
              href="/app?demo=1"
              aria-label="Explore the Studio workspace demo"
            >
              <picture>
                <source
                  media="(max-width: 600px)"
                  srcSet="/precision-today-mobile.webp"
                />
                <img
                  src="/precision-today.webp"
                  width="1440"
                  height="1000"
                  alt="Studio's Today workspace, showing a sample day's appointments and follow-up tasks"
                  fetchPriority="high"
                />
              </picture>
            </a>
            <figcaption>
              A day in Studio · demo practice with fictional records
            </figcaption>
          </figure>
          <section className="ph-story" aria-labelledby="ph-story-title">
            <h2 id="ph-story-title">
              Less keeping track.
              <br />
              More getting on.
            </h2>
            <div>
              <p>
                Follow an enquiry through to an appointment. Keep client details
                close to their history. See what needs doing today, and find the
                practice information you need without hunting through documents.
              </p>
              <p>
                Studio is a maintained product, developed with the people who
                use it. Tell us where your work gets awkward; we’ll work out
                what would make it simpler.
              </p>
              <a href="https://www.oceanheart.ai/studio">
                The thinking behind Studio <ArrowUpRight size={16} />
              </a>
            </div>
          </section>
        </main>
        <footer className="ph-footer">
          <span>oceanheart Studio</span>
          <a href="mailto:rick@oceanheart.ai?subject=Studio">
            Talk to Rick <ArrowUpRight size={14} />
          </a>
          <a href="https://www.oceanheart.ai">
            oceanheart.ai <ArrowUpRight size={14} />
          </a>
        </footer>
      </div>
    </StudioProvider>
  );
}
