"use client";

import { useRef, useState } from "react";
import { BrandMark } from "./brand-marks";
import { journeys } from "./journeys";

export function WorkflowExplorer() {
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const journey = journeys[selected];
  const current = journey.steps[step];
  function select(index: number) { setSelected(index); setStep(0); }

  return <div className="possibilities-explorer">
    <div className="possibilities-scenarios" role="tablist" aria-label="Choose an everyday difficulty" aria-orientation="vertical">
      {journeys.map((item, index) => <button key={item.id} ref={node => { tabs.current[index] = node; }}
        role="tab" id={`scenario-${item.id}`} aria-controls="selected-journey" aria-selected={selected === index}
        tabIndex={selected === index ? 0 : -1} onClick={() => select(index)} onKeyDown={event => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? journeys.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + journeys.length) % journeys.length;
          select(next); tabs.current[next]?.focus();
        }}>
        <span className="scenario-number">0{index + 1}</span><span>{item.label}</span>
      </button>)}
    </div>
    <div className="possibilities-journey" role="tabpanel" tabIndex={0} id="selected-journey" aria-labelledby={`scenario-${journey.id}`}>

      <h3 className="journey-quote">“{journey.quote}”</h3>
      <div className="journey-comparison">
        <div><h4>Where it gets stuck</h4><p>{journey.before}</p></div>
        <div><h4>What we could shape together</h4><p>{journey.after}</p></div>
      </div>
      <div className="journey-demo">
        <div className="journey-demo-header">Walk through the possibility</div>
        <ol className="journey-steps" aria-label="Example steps">
          {journey.steps.map((item, index) => <li key={item.title}><button aria-pressed={step === index} onClick={() => setStep(index)}><span>{index + 1}</span>{item.title}</button></li>)}
        </ol>
        <div className="journey-step-content" aria-live="polite" aria-atomic="true">
          <p>{current.detail}</p>
          <div className="journey-example-note"><h4>{current.screen}</h4><p>{current.note}</p><div className="example-action"><span aria-hidden="true">◌</span>{current.action}</div></div>
        </div>
        <div className="journey-demo-footer"><span>Step {step + 1} of {journey.steps.length}</span><button onClick={() => setStep((step + 1) % journey.steps.length)}>{step === journey.steps.length - 1 ? "Start again" : "Next step"}<span aria-hidden="true">→</span></button></div>
      </div>
      <div className="journey-tools" aria-label="Tools in this example">{journey.tools.map(tool => <span key={tool}>{tool}</span>)}</div>
      <p className="journey-outcome">{journey.outcome}</p>
      <a className="studio-link" href={`mailto:rick@oceanheart.ai?subject=${encodeURIComponent(`Studio: ${journey.short}`)}`}>Talk through something like this</a>
    </div>
  </div>;
}

const connections = [
  { id: "google", label: "Google Workspace", apps: ["Gmail", "Calendar", "Drive", "Forms"], title: "Keep the tools you know. Give the work a clearer path.", text: "A selected enquiry could lead to a task in Studio, an agreed appointment in Calendar and the right welcome document from Drive. You decide which conversations and folders belong in the workflow.", flow: ["An enquiry in Gmail", "Next step in Studio", "Time in Calendar", "A resource from Drive"], need: "Less clicks. More time" },
  { id: "microsoft", label: "Microsoft 365", apps: ["Outlook", "Teams", "OneDrive"], title: "Let a small team work from the same understanding.", text: "Connect appointments and administrative handoffs to the Outlook and Teams setup your practice already uses. Keep resources in OneDrive and make the right next step visible to the right person.", flow: ["An Outlook conversation", "A shared plan in Studio", "A Teams handoff", "An agreed resource"], need: "A handoff someone can actually pick up." },
  { id: "sessions", label: "Meetings & groups", apps: ["Zoom", "Forms", "Calendar"], title: "Carry the idea all the way to the first session.", text: "Build an enrolment journey around your group: a form, a welcome conversation, joining details and the materials you want people to have. Rehearse the setup before opening places.", flow: ["An expression of interest", "Enrolment in Studio", "A Zoom meeting", "Joining instructions"], need: "More room to facilitate. Less coordination to carry." },
  { id: "payments", label: "Payments & accounts", apps: ["Stripe", "Xero"], title: "Let the payment record reach the places that need it.", text: "A confirmed payment could update the practice view and prepare the appropriate accounting entry. Agreed exceptions stay visible for you to handle with care. Scope and setup depend on your accounts.", flow: ["Payment confirmed", "Status in Studio", "Accounting entry", "Exceptions for review"], need: "A clearer picture without entering the same fact twice." },
  { id: "resources", label: "Resources & community", apps: ["Docs / Word", "Drive / OneDrive", "Mailchimp"], title: "Share your work in ways people can use.", text: "Prepare approved resources from your documents and connect them to an agreed client journey. Separately, help people who explicitly subscribe hear about the groups and events that interest them.", flow: ["Your approved material", "An accessible format", "Your review", "The agreed audience"], need: "Knowledge made usable, with a choice about what is shared." },
];

export function ConnectionExplorer() {
  const [selected, setSelected] = useState(0);
  const current = connections[selected];
  return <div className="connection-explorer">
    <div className="connection-choices" role="group" aria-label="Explore tools you already use">{connections.map((item, index) => <button key={item.id} aria-pressed={selected === index} onClick={() => setSelected(index)}><BrandMark brand={item.id} />{item.label}</button>)}</div>
    <div className="connection-content" aria-live="polite" aria-atomic="true">
      <div><div className="connection-apps">{current.apps.map(app => <span key={app}>{app}</span>)}</div><h3>{current.title}</h3><p>{current.text}</p></div>
      <ol className="connection-flow" aria-label="Example connected workflow">{current.flow.map((label, index) => <li key={label}><span className="connection-dot">{index + 1}</span><span>{label}</span></li>)}</ol>
    </div>
    <p className="connection-need">{current.need}</p>
  </div>;
}
