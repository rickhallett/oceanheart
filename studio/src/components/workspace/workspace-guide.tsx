"use client";
import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  CreditCard,
  Globe,
  ShoppingBag,
  Users,
  ListChecks,
} from "lucide-react";
import type { View } from "./model";
import "./workflow-finish.css";
type Go = (view: View, extras?: Record<string, string>) => void;
export function WorkspaceGuide({ go }: { go: Go }) {
  const guides = [
    {
      icon: CalendarDays,
      title: "Set up your practice",
      text: "Add your time zone and usual hours, then create the services you offer.",
      target: "setup" as View,
      action: "Open Setup",
    },
    {
      icon: Users,
      title: "From enquiry to appointment",
      text: "Read an enquiry, link the client and arrange their next session. Import selected messages from Gmail when you need them.",
      target: "inbox" as View,
      action: "Open Enquiries",
    },
    {
      icon: ListChecks,
      title: "Keep track of follow-ups",
      text: "Add a task, choose a due date and mark it complete when the work is done.",
      target: "tasks" as View,
      action: "Open Tasks",
    },
    {
      icon: BookOpen,
      title: "Find answers in your documents",
      text: "Add a document to Knowledge and choose Use in answers. Ask a question and follow its source link to read the supporting text.",
      target: "knowledge" as View,
      action: "Open Knowledge",
    },
  ];
  return (
    <section className="workflow-guide">
      <div className="workflow-intro">
        <CircleHelp size={26} />
        <h2>A little help with the everyday work.</h2>
        <p>
          Start with a workflow below, or get in touch when something does not
          look right.
        </p>
      </div>
      <div className="workflow-guide-list">
        {guides.map(({ icon: Icon, ...g }) => (
          <article key={g.title}>
            <Icon size={20} aria-hidden="true" />
            <div>
              <h3>{g.title}</h3>
              <p>{g.text}</p>
              <button onClick={() => go(g.target)}>{g.action}</button>
            </div>
          </article>
        ))}
      </div>
      <section className="workflow-help">
        <h2>Questions you might have</h2>
        <details>
          <summary>Who can see my documents and answers?</summary>
          <p>
            The Knowledge library and its answers are private to practice
            owners. Tasks you create are visible to practice members.
          </p>
        </details>
        <details>
          <summary>What happens when I edit a document?</summary>
          <p>
            Your new version is saved separately. Choose Use in answers again
            when it is ready. Earlier answers cannot continue to use an outdated
            or withdrawn source.
          </p>
        </details>
        <details>
          <summary>Does the assistant change things automatically?</summary>
          <p>
            No. Review the exact task and confirm the change yourself. You can
            cancel it before anything happens.
          </p>
        </details>
        <details>
          <summary>Why can a booking fall outside my usual hours?</summary>
          <p>
            Saved hours are a guide unless you enable Enforce practice hours in
            Settings. Existing appointments are retained.
          </p>
        </details>
      </section>
      <div className="workflow-contact">
        <h2>Talk to a person</h2>
        <p>
          Tell Rick what you were trying to do and what happened. Leave out
          private client details.
        </p>
        <a href="mailto:rick@oceanheart.ai?subject=Studio%20help">Email Rick</a>
      </div>
    </section>
  );
}
const upcoming = {
  website: {
    icon: Globe,
    title: "Your practice, presented your way",
    text: "Practice-site publishing is being developed. Your service details can already be maintained in Studio, ready for your next step.",
    target: "services",
    action: "Manage services",
  },
  portal: {
    icon: Users,
    title: "A simpler way for clients to stay in touch",
    text: "Client self-service is being developed. For now, keep appointment arrangements and client information together in your workspace.",
    target: "clients",
    action: "Open Clients",
  },
  payments: {
    icon: CreditCard,
    title: "Payments start with a booking",
    text: "Your bookings keep their agreed service and price. Open a booking to see the payment actions available for your practice.",
    target: "calendar",
    action: "View bookings",
  },
  shop: {
    icon: ShoppingBag,
    title: "Space for the things you create",
    text: "Product sales and order management are planned. You can already organise the sessions and services you offer.",
    target: "services",
    action: "View services",
  },
  roadmap: {
    icon: ListChecks,
    title: "Help shape what comes next",
    text: "What takes too much effort in your practice? Tell us about the workflow, the workaround and what a better day would look like.",
    target: "support",
    action: "Get in touch",
  },
} as const;
export function UpcomingWorkspace({ view, go }: { view: View; go: Go }) {
  const item = upcoming[view as keyof typeof upcoming] ?? upcoming.roadmap;
  const Icon = item.icon;
  return (
    <section className="workflow-upcoming">
      <Icon size={30} aria-hidden="true" />
      <h2>{item.title}</h2>
      <p>{item.text}</p>
      <button onClick={() => go(item.target)}>{item.action}</button>
      <a href="mailto:rick@oceanheart.ai?subject=Studio%20feedback">
        Share what you need
      </a>
    </section>
  );
}
