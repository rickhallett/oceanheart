"use client";

import { useRef, useState } from "react";
import { useSoftTransition, useTransitionDelay } from "../use-soft-transition";
import { BrandMark } from "./brand-marks";
import { journeys } from "./journeys";

export function WorkflowExplorer() {
  const [selected, setSelected] = useState(0);
  const transition = useTransitionDelay();
  const [step, setStep] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const scenarioMotion = useSoftTransition(selected);
  const stepMotion = useSoftTransition(step);
  const journey = journeys[selected];
  const current = journey.steps[step];
  function select(index: number) { setSelected(index); setStep(0); }

  return <div className="possibilities-explorer">
    <div className="possibilities-scenarios" role="tablist" aria-label="Choose an everyday difficulty" aria-orientation="vertical">
      {journeys.map((item, index) => <button key={item.id} ref={node => { tabs.current[index] = node; }}
        role="tab" id={`scenario-${item.id}`} aria-controls="selected-journey" aria-selected={selected === index}
        tabIndex={selected === index ? 0 : -1} onClick={() => transition(() => select(index))} onKeyDown={event => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? journeys.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + journeys.length) % journeys.length;
          transition(() => select(next), true); tabs.current[next]?.focus();
        }}>
        <span className="scenario-number">0{index + 1}</span><span>{item.label}</span>
      </button>)}
    </div>
    <div ref={scenarioMotion} className="possibilities-journey" role="tabpanel" tabIndex={0} id="selected-journey" aria-labelledby={`scenario-${journey.id}`}>

      <h3 className="journey-quote">“{journey.quote}”</h3>
      <div className="journey-comparison">
        <div><h4>Where it gets stuck</h4><p>{journey.before}</p></div>
        <div><h4>What we could shape together</h4><p>{journey.after}</p></div>
      </div>
      <div className="journey-demo">
        <div className="journey-demo-header">Walk through the possibility</div>
        <ol className="journey-steps" aria-label="Example steps">
          {journey.steps.map((item, index) => <li key={item.title}><button aria-pressed={step === index} onClick={() => transition(() => setStep(index))}><span>{index + 1}</span>{item.title}</button></li>)}
        </ol>
        <div ref={stepMotion} className="journey-step-content" aria-live="polite" aria-atomic="true">
          <p>{current.detail}</p>
          <div className="journey-example-note"><h4>{current.screen}</h4><p>{current.note}</p><div className="example-action"><span aria-hidden="true">◌</span>{current.action}</div></div>
        </div>
        <div className="journey-demo-footer"><span>Step {step + 1} of {journey.steps.length}</span><button onClick={() => transition(() => setStep((step + 1) % journey.steps.length))}>{step === journey.steps.length - 1 ? "Start again" : "Next step"}<span aria-hidden="true">→</span></button></div>
      </div>
      <div className="journey-tools" aria-label="Tools in this example">{journey.tools.map(tool => <span key={tool}>{tool}</span>)}</div>
      <p className="journey-outcome">{journey.outcome}</p>
      <a className="studio-link" href={`mailto:rick@oceanheart.ai?subject=${encodeURIComponent(`Studio: ${journey.short}`)}`}>Talk through something like this</a>
    </div>
  </div>;
}

const connections = [
  { id: "google", label: "Google Workspace", apps: ["Gmail", "Calendar", "Drive", "Forms"], title: "Keep your mailbox. Give the work a clearer path.", text: "An agent could distinguish enquiries from other mail, follow the conversation and prepare a reply using your service details. Rick helps define what counts as an enquiry and tests the awkward cases with you. The result has a place in Studio, with the original message close at hand.", flow: ["An enquiry in Gmail", "Context from your documents", "A draft in Studio", "Your review and next step"], need: "Less clicks. More time." },
  { id: "microsoft", label: "Microsoft 365", apps: ["Outlook", "Calendar", "OneDrive"], title: "Pick up the thread without searching every app.", text: "Ask what still needs your attention this week. An agent could bring together the relevant Outlook conversations, appointments and OneDrive material into a short brief, with sources and unresolved questions. We shape its priorities around the way you work.", flow: ["Your Outlook conversations", "Your calendar and documents", "A brief in Studio", "The next steps that matter"], need: "A clearer start to your working day." },
  { id: "sessions", label: "Appointments & follow-ups", apps: ["Calendar", "Zoom", "Email"], title: "Keep the practical details with the appointment.", text: "A connected workflow could prepare joining details, keep track of agreed follow-ups and identify what needs updating when a session moves. Rick tests the whole journey, including the steps that need your attention when a tool is unavailable.", flow: ["An agreed appointment", "The right joining details", "A change of plan", "Updates and exceptions in Studio"], need: "Less coordination around the time you spend with people." },
  { id: "payments", label: "Invoices & accounts", apps: ["Spreadsheets", "Xero", "Stripe"], title: "Prepare the paperwork from the work you have done.", text: "Your session records, agreed rates and previous invoices could become a draft ready to review. Each line keeps its source. Where your accounts support it, confirmed payments can update the picture without you entering the same fact twice.", flow: ["Confirmed session records", "Your billing instructions", "An invoice draft", "Your review and accounting system"], need: "Less time reconstructing the month." },
  { id: "resources", label: "Documents & knowledge", apps: ["Docs / Word", "Drive / OneDrive"], title: "Give your assistant the information you trust.", text: "Choose the documents that describe your practice. We can build a way to find the relevant information, show its source and keep answers in step with changes. Your corrections help us improve the instructions and check the next version.", flow: ["Your current documents", "A practical question", "An answer with sources", "Corrections and improvements"], need: "Your knowledge, easier to put to work." },
];

export function ConnectionExplorer() {
  const [selected, setSelected] = useState(0);
  const transition = useTransitionDelay();
  const current = connections[selected];
  const connectionMotion = useSoftTransition(selected);
  return <div className="connection-explorer">
    <div className="connection-choices" role="group" aria-label="Explore tools you already use">{connections.map((item, index) => <button key={item.id} aria-pressed={selected === index} onClick={() => transition(() => setSelected(index))}><BrandMark brand={item.id} />{item.label}</button>)}</div>
    <div ref={connectionMotion} className="connection-content" aria-live="polite" aria-atomic="true">
      <div><div className="connection-apps">{current.apps.map(app => <span key={app}>{app}</span>)}</div><h3>{current.title}</h3><p>{current.text}</p></div>
      <ol className="connection-flow" aria-label="Example connected workflow">{current.flow.map((label, index) => <li key={label}><span className="connection-dot">{index + 1}</span><span>{label}</span></li>)}</ol>
    </div>
    <p className="connection-need">{current.need}</p>
  </div>;
}
