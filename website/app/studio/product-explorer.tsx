"use client";

import { useRef, useState } from "react";
import { useSoftTransition } from "./use-soft-transition";

const views = [
  {
    id: "today",
    title: "Today",
    heading: "Begin with the day in front of you.",
    description:
      "Appointments and tasks share a starting point. See who is coming, what needs attention, and where to go next.",
    path: "",
  },
  {
    id: "enquiries",
    title: "Enquiries",
    heading: "Give the first conversation a place.",
    description:
      "Keep an enquiry in view, prepare a thoughtful reply and decide what a helpful next step looks like.",
    path: "/inbox",
  },
  {
    id: "clients",
    title: "Clients",
    heading: "Pick up the relationship again.",
    description:
      "Find a client and the context around their work with you, from the first conversation to their appointment history.",
    path: "/clients",
  },
  {
    id: "bookings",
    title: "Bookings",
    heading: "Put the person, service and time together.",
    description:
      "Move from an overview of the day into the appointments themselves, and see how your services fit into the week.",
    path: "/calendar",
  },
];

export function ProductExplorer({ gentleMotion = false }: { gentleMotion?: boolean }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const view = views[selected];
  const panelMotion = useSoftTransition(selected, gentleMotion);
  return (
    <div className="studio-explorer">
      <div className="studio-view-tabs" role="tablist" aria-label="Explore Studio views">
        {views.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected === index}
            aria-controls={`view-${item.id}`}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              const key = event.key;
              if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(key)) return;
              event.preventDefault();
              const next =
                key === "Home"
                  ? 0
                  : key === "End"
                    ? views.length - 1
                    : (index + (key === "ArrowRight" ? 1 : -1) + views.length) % views.length;
              setSelected(next);
              tabs.current[next]?.focus();
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div
        ref={panelMotion}
        role="tabpanel"
        id={`view-${view.id}`}
        aria-labelledby={`tab-${view.id}`}
        tabIndex={0}
        className="studio-view-panel"
      >
        <div className="studio-view-description">
          <h3>{view.heading}</h3>
          <p>{view.description}</p>
        </div>
        <figure>
          <picture>
            <source
              media="(max-width: 600px)"
              srcSet={`/images/studio/precision-${view.id}-mobile.webp`}
              width="390"
              height="900"
            />
            <img
              src={`/images/studio/precision-${view.id}.webp`}
              width="1440"
              height="1000"
              alt={`Studio ${view.title} screen with fictional Rick Hallett practice data`}
              loading="lazy"
            />
          </picture>
          <figcaption>
            <a href={`https://studio.oceanheart.ai/app${view.path}?demo=1`}>
              Try {view.title} in the demo
            </a>
            <a
              className="studio-desktop-image-link"
              href={`/images/studio/precision-${view.id}.webp`}
            >
              Open full-size screenshot
            </a>
            <a
              className="studio-mobile-image-link"
              href={`/images/studio/precision-${view.id}-mobile.webp`}
            >
              Open full-size screenshot
            </a>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
