"use client";
import { useState } from "react";
import {
  ArrowRight,
  Plus,
  Check,
  ExternalLink,
  Download,
  Link as LinkIcon,
  RefreshCw,
  Globe,
  Heart,
  Package,
} from "lucide-react";
import {
  useStudio,
  Panel,
  Pill,
  Empty,
  Action,
  Field,
  priorities,
} from "./context";
import {
  features,
  modules,
  money,
  demoDay,
  uid,
  type Priority,
  type View,
  type Ticket,
} from "./model";
import { BookingForm } from "./practice";
export function Website() {
  const { state, update, open } = useStudio();
  const [name, setName] = useState(state.practice.name);
  const [welcome, setWelcome] = useState(state.practice.welcome);
  const [device, setDevice] = useState("Desktop");
  return (
    <>
      <div className="ws-toolbar">
        <Pill tone={state.published ? "green" : "amber"}>
          {state.published ? "Published in demo" : "Draft changes"}
        </Pill>
        <div className="ws-segment">
          {["Desktop", "Mobile"].map((v) => (
            <button
              key={v}
              aria-pressed={device === v}
              onClick={() => setDevice(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <Action
          onClick={() =>
            update((d) => {
              d.practice.name = name;
              d.practice.welcome = welcome;
              d.published = true;
              d.activity.unshift("Website · sample version published");
            }, "Website published inside the demo. No public client site was created.")
          }
        >
          <Globe size={15} /> Publish demo
        </Action>
      </div>
      <div className="ws-editor-grid">
        <Panel title="Make it yours">
          <Field label="Practice name">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                update((d) => {
                  d.published = false;
                });
              }}
            />
          </Field>
          <Field label="Welcome headline">
            <textarea
              value={welcome}
              onChange={(e) => {
                setWelcome(e.target.value);
                update((d) => {
                  d.published = false;
                });
              }}
            />
          </Field>
          <p className="ws-help">
            Your services and prices come from Services. Publishing saves this
            wording to your practice.
          </p>
          <div className="ws-website-check">
            <Check size={15} /> Clear service descriptions
            <br />
            <Check size={15} /> Prices and duration
            <br />
            <Check size={15} /> A direct way to book
          </div>
        </Panel>
        <div
          className={`ws-site-preview ${device === "Mobile" ? "mobile" : ""}`}
        >
          <div className="ws-browser-bar">
            <span />
            <span />
            <span />
            <small>your-practice.example · preview</small>
          </div>
          <div className="ws-client-site">
            <nav>
              {name}
              <span>{state.practice.location}</span>
            </nav>
            <div className="ws-site-sun" />
            <h2>{welcome}</h2>
            <p>
              {state.practice.modality}. Personal, unhurried care in{" "}
              {state.practice.location.toLowerCase()}.
            </p>
            <button
              onClick={() => open("Example client booking", <BookingForm />)}
            >
              Find a time for you <ArrowRight size={16} />
            </button>
            <h3>Room for you</h3>
            {state.services
              .filter((s) => s.active)
              .map((s) => (
                <div className="ws-site-service" key={s.id}>
                  <div>
                    <strong>{s.name}</strong>
                    <p>{s.description}</p>
                  </div>
                  <span>
                    {money(s.price)} · {s.duration} min
                  </span>
                </div>
              ))}
            <footer>Questions before booking? {state.practice.email}</footer>
          </div>
        </div>
      </div>
    </>
  );
}
export function Payments() {
  const { state, update } = useStudio();
  const [filter, setFilter] = useState("All");
  return (
    <>
      <div className="ws-stat-strip">
        <div>
          <span>Received</span>
          <strong>
            {money(
              state.payments
                .filter((p) => p.status === "Paid")
                .reduce((a, p) => a + p.amount, 0),
            )}
          </strong>
        </div>
        <div>
          <span>Awaiting payment</span>
          <strong>
            {money(
              state.payments
                .filter((p) => p.status === "Pending")
                .reduce((a, p) => a + p.amount, 0),
            )}
          </strong>
        </div>
        <div>
          <span>Connection</span>
          <strong className="ws-stat-text">
            Stripe <small>sample account</small>
          </strong>
        </div>
      </div>
      <div className="ws-toolbar">
        <div className="ws-segment">
          {["All", "Paid", "Pending", "Refunded"].map((v) => (
            <button
              key={v}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <Pill>Test data only</Pill>
      </div>
      <Panel>
        {state.payments
          .filter((p) => filter === "All" || p.status === filter)
          .map((p) => (
            <div className="ws-payment-row" key={p.id}>
              <div>
                <h3>{state.clients.find((c) => c.id === p.clientId)?.name}</h3>
                <p>{p.description}</p>
              </div>
              <strong>{money(p.amount)}</strong>
              <Pill tone={p.status === "Paid" ? "green" : "amber"}>
                {p.status}
              </Pill>
              {p.status === "Pending" ? (
                <Action
                  secondary
                  onClick={() =>
                    update((d) => {
                      d.payments.find((x) => x.id === p.id)!.status = "Paid";
                      d.activity.unshift(
                        `Payment · ${p.description} marked paid in demo`,
                      );
                    }, "Sample payment received. No card was charged.")
                  }
                >
                  Simulate payment
                </Action>
              ) : p.status === "Paid" ? (
                <button
                  className="ws-link"
                  disabled={state.approvals.some(
                    (a) =>
                      a.type === "refund" &&
                      a.paymentId === p.id &&
                      a.status !== "Declined",
                  )}
                  onClick={() =>
                    update((d) => {
                      if (
                        d.approvals.some(
                          (a) =>
                            a.type === "refund" &&
                            a.paymentId === p.id &&
                            a.status !== "Declined",
                        )
                      )
                        return;
                      d.approvals.push({
                        id: uid(),
                        title: `Refund ${p.description}`,
                        detail: `Request to refund ${money(p.amount)} to ${d.clients.find((c) => c.id === p.clientId)?.name}. Original payment ${p.id}.`,
                        type: "refund",
                        paymentId: p.id,
                        amount: p.amount,
                        status: "Pending",
                      });
                    }, "Refund request queued for human approval.")
                  }
                >
                  Request refund
                </button>
              ) : (
                <span>Complete</span>
              )}
            </div>
          ))}
      </Panel>
      <p className="ws-footnote">
        Stripe is represented by local sample transactions. No checkout,
        payment, refund or reminder reaches an external service.
      </p>
    </>
  );
}
export function Shop() {
  const { state, update, open } = useStudio();
  return (
    <>
      <div className="ws-info-strip">
        <Package size={24} />
        <div>
          <strong>A small shop, if it belongs in your practice.</strong>
          <p>
            Explore products, stock and order status before deciding whether
            commerce belongs in the MVP.
          </p>
        </div>
        <Pill>
          {state.connections.Shopify
            ? "Shopify · sample connected"
            : "Shopify · sample disconnected"}
        </Pill>
      </div>
      <div className="ws-service-grid">
        {state.products.map((p) => (
          <Panel key={p.id}>
            <div className="ws-product-art">
              <span>
                {p.name.includes("journal")
                  ? "A MOMENT\nOF CALM"
                  : "A LITTLE\nTIME FOR YOU"}
              </span>
            </div>
            <h2>{p.name}</h2>
            <p>
              {money(p.price)} · {p.stock} available
            </p>
            <Action
              secondary
              disabled={p.stock === 0}
              onClick={() =>
                update((d) => {
                  d.products.find((x) => x.id === p.id)!.stock--;
                  d.orders.unshift({
                    id: "OH-" + uid().slice(0, 4),
                    clientId: "c1",
                    item: p.name,
                    status: "Processing",
                  });
                }, "Sample order created and stock updated.")
              }
            >
              Create sample order
            </Action>
          </Panel>
        ))}
      </div>
      <Panel title="Orders">
        {state.orders.map((o) => (
          <div className="ws-simple-row" key={o.id}>
            <div>
              <strong>
                {o.id} · {o.item}
              </strong>
              <small>
                {state.clients.find((c) => c.id === o.clientId)?.name}
              </small>
            </div>
            <Pill>{o.status}</Pill>
            <Action
              secondary
              disabled={o.status === "Dispatched"}
              onClick={() =>
                update((d) => {
                  d.orders.find((x) => x.id === o.id)!.status = "Dispatched";
                }, "Sample order marked dispatched.")
              }
            >
              Mark dispatched
            </Action>
          </div>
        ))}
      </Panel>
    </>
  );
}
function TicketThread({ id }: { id: string }) {
  const { state, update } = useStudio();
  const [text, setText] = useState("");
  const t = state.tickets.find((t) => t.id === id)!;
  return (
    <div className="ws-form">
      <Pill>{t.status}</Pill>
      {t.messages.map((m, i) => (
        <div className="ws-bubble" key={i}>
          <p>{m}</p>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          update((d) => {
            d.tickets
              .find((x) => x.id === id)!
              .messages.push(`${d.practice.owner}: ${text}`);
          }, "Saved to the sample support conversation. Nothing was sent.");
          setText("");
        }}
      >
        <Field label="Add to the conversation">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </Field>
        <Action type="submit">Add sample message</Action>
      </form>
      <Action
        secondary
        onClick={() =>
          update((d) => {
            d.tickets.find((x) => x.id === id)!.status =
              t.status === "Resolved" ? "Open" : "Resolved";
          }, "Support status updated.")
        }
      >
        {t.status === "Resolved" ? "Reopen request" : "Mark resolved"}
      </Action>
    </div>
  );
}
function TicketForm() {
  const { update, close } = useStudio();
  return (
    <form
      className="ws-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        update((d) => {
          d.tickets.unshift({
            id: "ST-" + uid().slice(0, 4),
            title: String(f.get("title")),
            status: "Open",
            messages: [`${d.practice.owner}: ${f.get("body")}`],
          });
        }, "Sample support request saved. Rick has not been notified.");
        close();
      }}
    >
      <Field label="What would you like a hand with?">
        <input name="title" required />
      </Field>
      <Field label="A little more detail">
        <textarea name="body" rows={5} required />
      </Field>
      <Action type="submit">Create sample request</Action>
    </form>
  );
}
export function Support() {
  const { state, open } = useStudio();
  return (
    <>
      <div className="ws-support-intro">
        <span className="ws-partner-initial">R</span>
        <div>
          <h1>You don’t have to figure it out alone.</h1>
          <p>
            A website change, a confusing booking, or something you wish worked
            differently. This is where the conversation with Rick lives.
          </p>
        </div>
        <Action onClick={() => open("Ask your studio partner", <TicketForm />)}>
          <Plus size={15} /> Start a request
        </Action>
      </div>
      <Panel title="Your conversations">
        {state.tickets.map((t) => (
          <button
            className="ws-source-row"
            key={t.id}
            onClick={() => open(t.title, <TicketThread id={t.id} />)}
          >
            <span className="ws-source-icon">
              <Heart size={19} />
            </span>
            <div>
              <h3>{t.title}</h3>
              <p>
                {t.id} · {t.messages.length} messages
              </p>
            </div>
            <Pill tone={t.status === "Resolved" ? "green" : ""}>
              {t.status}
            </Pill>
            <ArrowRight size={16} />
          </button>
        ))}
      </Panel>
    </>
  );
}
export function Setup() {
  const { state, update, go } = useStudio();
  const [description, setDescription] = useState(state.setupDescription);
  const [step, setStep] = useState(state.setupStep);
  const [name, setName] = useState(state.practice.name);
  const [owner, setOwner] = useState(state.practice.owner);
  const [modality, setModality] = useState(state.practice.modality);
  function next() {
    setStep(step + 1);
    update((d) => {
      d.setupStep = step + 1;
    });
  }
  return (
    <div className="ws-onboarding">
      <div className="ws-setup-progress">
        {[
          "Your practice",
          "What would help",
          "Your structure",
          "Make it yours",
        ].map((v, i) => (
          <button
            key={v}
            className={step === i ? "active" : ""}
            onClick={() => setStep(i)}
          >
            <span>{i < step ? <Check size={13} /> : i + 1}</span>
            {v}
          </button>
        ))}
      </div>
      <Panel>
        {step === 0 ? (
          <>
            <h1>Start with your world.</h1>
            <p>
              Tell us how your practice works today. Untidy spreadsheets and
              half-finished notes are welcome.
            </p>
            <Field label="About your practice">
              <textarea
                rows={6}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  update((d) => {
                    d.setupDescription = e.target.value;
                  });
                }}
              />
            </Field>
            <Action disabled={!description.trim()} onClick={next}>
              Explore a proposed setup <ArrowRight size={16} />
            </Action>
            <p className="ws-help">
              This is a guided example, not an AI analysis. Your description is
              carried into the review below.
            </p>
          </>
        ) : step === 1 ? (
          <>
            <h1>Where would a little order help?</h1>
            <p>
              Choose the areas you would like included in your first version.
            </p>
            <div className="ws-setup-options">
              {features
                .filter((f) =>
                  [
                    "inbox",
                    "calendar",
                    "website",
                    "payments",
                    "knowledge",
                    "shop",
                  ].includes(f.id),
                )
                .map((f) => (
                  <label key={f.id}>
                    <input
                      type="checkbox"
                      checked={state.priorities[f.id] === "Essential"}
                      onChange={(e) =>
                        update((d) => {
                          d.priorities[f.id] = e.target.checked
                            ? "Essential"
                            : "Later";
                        })
                      }
                    />
                    <span>
                      <strong>{f.title}</strong>
                      <small>{f.description}</small>
                    </span>
                  </label>
                ))}
            </div>
            <Action onClick={next}>Review the shape of your practice</Action>
          </>
        ) : step === 2 ? (
          <>
            <h1>Everything with a place.</h1>
            <p className="ws-note">{description}</p>
            <p>
              This example structure links the people, sessions and information
              in your practice.
            </p>
            <div className="ws-schema">
              {[
                ["People", "Contact details · practical preferences"],
                ["Services", "Price · duration · description"],
                ["Bookings", "Person + service + time"],
                ["Conversations", "Person + replies + next step"],
                ["Knowledge", "Source + audience + version"],
              ].map(([title, body]) => (
                <div key={title}>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              ))}
            </div>
            <Action onClick={next}>
              Review practice details <ArrowRight size={16} />
            </Action>
          </>
        ) : (
          <>
            <h1>A home with your name on it.</h1>
            <Field label="Practice name">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Your first name">
              <input value={owner} onChange={(e) => setOwner(e.target.value)} />
            </Field>
            <Field label="Your work">
              <input
                value={modality}
                onChange={(e) => setModality(e.target.value)}
              />
            </Field>
            <Action
              disabled={!name.trim() || !owner.trim()}
              onClick={() => {
                update((d) => {
                  d.practice.name = name;
                  d.practice.owner = owner;
                  d.practice.modality = modality;
                  d.setupStep = 3;
                }, "Your sample practice is ready.");
                go("today");
              }}
            >
              Open your practice <ArrowRight size={16} />
            </Action>
          </>
        )}
      </Panel>
    </div>
  );
}
export function Settings() {
  const { state, update, open, close, reset } = useStudio();
  const [resetRevision, setResetRevision] = useState(0);
  return (
    <div className="ws-two-column">
      <Panel title="Practice details">
        <form
          key={`${resetRevision}:${JSON.stringify(state.practice)}`}
          className="ws-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update((d) => {
              d.practice.name = String(f.get("name"));
              d.practice.owner = String(f.get("owner"));
              d.practice.email = String(f.get("email"));
              d.practice.location = String(f.get("location"));
              d.practice.hours = String(f.get("hours"));
            }, "Practice settings saved.");
          }}
        >
          {[
            ["name", "Practice name"],
            ["owner", "First name"],
            ["email", "Practice email"],
            ["location", "Location"],
            ["hours", "Usual availability"],
          ].map(([k, label]) => (
            <Field key={k} label={label}>
              <input
                name={k}
                type={k === "email" ? "email" : "text"}
                required
                defaultValue={state.practice[k as keyof typeof state.practice]}
              />
            </Field>
          ))}
          <p className="ws-help">
            Availability is descriptive in this mock. The booking form checks
            overlapping sessions.
          </p>
          <Action type="submit">Save details</Action>
        </form>
      </Panel>
      <div>
        <Panel title="Connected tools">
          {Object.entries(state.connections).map(([name, connected]) => (
            <div className="ws-connection" key={name}>
              <span className="ws-integration-icon">{name.slice(0, 1)}</span>
              <div>
                <h3>{name}</h3>
                <small>
                  {connected
                    ? "Sample connection active"
                    : "Not connected in sample"}
                </small>
              </div>
              <button
                role="switch"
                aria-checked={connected}
                aria-label={`${name} sample connection`}
                className={`ws-switch ${connected ? "on" : ""}`}
                onClick={() =>
                  update(
                    (d) => {
                      d.connections[name] = !connected;
                    },
                    `${name} sample connection ${connected ? "disabled" : "enabled"}. No account access changed.`,
                  )
                }
              >
                <span />
              </button>
            </div>
          ))}
          <p className="ws-help">
            These switches simulate connection state. No account authorisation
            or API requests take place.
          </p>
        </Panel>
        <Panel title="Your prototype">
          <p>
            Changes are saved in this browser. Use fictional information. Export
            roadmap decisions before resetting.
          </p>
          <Action
            secondary
            onClick={() =>
              open(
                "Restore the sample practice?",
                <div className="ws-form">
                  <p>
                    This clears your local sample changes and roadmap
                    priorities. Export your roadmap first if you want to keep
                    it.
                  </p>
                  <div className="ws-actions">
                    <Action
                      onClick={() => {
                        reset();
                        setResetRevision((v) => v + 1);
                        close();
                      }}
                    >
                      Restore sample data
                    </Action>
                    <Action secondary onClick={close}>
                      Keep my changes
                    </Action>
                  </div>
                </div>,
              )
            }
          >
            Reset demo
          </Action>
        </Panel>
      </div>
    </div>
  );
}
export function Roadmap() {
  const { state, update, go } = useStudio();
  const [filter, setFilter] = useState<Priority | "All">("All");
  function exportPlan() {
    const text = JSON.stringify(
      {
        project: "Oceanheart Studio",
        exportedAt: new Date().toISOString(),
        features: features.map((f) => ({
          ...f,
          priority: state.priorities[f.id] || "Unsorted",
          notes: state.featureNotes[f.id] || "",
        })),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "oceanheart-studio-roadmap.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="ws-roadmap-intro">
        <div>
          <h1>What does your first version need?</h1>
          <p>
            Try the workflows. Keep the essentials. Your decisions here are
            saved locally and can be exported into the build plan.
          </p>
        </div>
        <Action onClick={exportPlan}>
          <Download size={16} /> Export roadmap
        </Action>
      </div>
      <div className="ws-priority-summary">
        {priorities.map((p) => (
          <button
            className={filter === p ? "selected" : ""}
            onClick={() => setFilter(filter === p ? "All" : p)}
            key={p}
          >
            <strong>
              {
                features.filter(
                  (f) => (state.priorities[f.id] || "Unsorted") === p,
                ).length
              }
            </strong>
            <span>{p}</span>
          </button>
        ))}
      </div>
      <div className="ws-roadmap-list">
        {features
          .filter(
            (f) =>
              filter === "All" ||
              (state.priorities[f.id] || "Unsorted") === filter,
          )
          .map((f) => (
            <Panel key={f.id}>
              <div className="ws-roadmap-top">
                <div>
                  <h2>{f.title}</h2>
                  <p>{f.description}</p>
                </div>
                <select
                  aria-label={`${f.title} priority`}
                  value={state.priorities[f.id] || "Unsorted"}
                  onChange={(e) =>
                    update((d) => {
                      d.priorities[f.id] = e.target.value as Priority;
                    })
                  }
                >
                  {priorities.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="ws-roadmap-journey">{f.journey}</div>
              {f.dependencies.length > 0 && (
                <p className="ws-dependencies">
                  Depends on:{" "}
                  {f.dependencies
                    .map((id) => modules.find((m) => m[0] === id)?.[1])
                    .join(", ")}
                </p>
              )}
              <div className="ws-roadmap-bottom">
                <input
                  aria-label={`${f.title} roadmap note`}
                  placeholder="What would make this useful? What can wait?"
                  value={state.featureNotes[f.id] || ""}
                  onChange={(e) =>
                    update((d) => {
                      d.featureNotes[f.id] = e.target.value;
                    })
                  }
                />
                <button className="ws-link" onClick={() => go(f.id)}>
                  Try this feature <ArrowRight size={14} />
                </button>
              </div>
            </Panel>
          ))}
      </div>
    </>
  );
}
export function Operations() {
  const { state, update } = useStudio();
  const [tab, setTab] = useState("Activity");
  const [env, setEnv] = useState("Staging");
  return (
    <>
      <div className="ws-info-strip">
        <ShieldIcon />
        <div>
          <strong>Behind the service, for the studio operator.</strong>
          <p>
            A product view of the proposed engineering roadmap. All traces,
            environments and releases below are simulated.
          </p>
        </div>
      </div>
      <div className="ws-toolbar">
        <div className="ws-segment">
          {["Activity", "Retrieval", "Delivery"].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "Activity" ? (
        <Panel title="What happened, and why">
          {state.activity.map((a, i) => (
            <div className="ws-log-row" key={i}>
              <span className="ws-dot" />
              <span>{a}</span>
              <Pill>Demo</Pill>
            </div>
          ))}
          <div className="ws-explainer">
            <h3>Tracing & handoff</h3>
            <p>
              Live LangSmith traces would connect evidence, validation, approval
              and action results. Support requests here represent the intended
              Linear handoff.
            </p>
          </div>
        </Panel>
      ) : tab === "Retrieval" ? (
        <>
          <Panel title="From source to supported answer">
            <div className="ws-pipeline">
              {[
                "Audience & version filter",
                "Lexical + vector retrieval",
                "Rank fusion",
                "Rerank evidence",
                "Citations & abstention",
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  <h3>{s}</h3>
                  <p>
                    {i === 0
                      ? `${state.sources.filter((s) => s.status === "Ready").length} ready sample sources`
                      : "Planned capability · visual mock"}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Evaluation scenarios">
            {[
              "Missing answer → abstain",
              "Private source → exclude from public answer",
              "Policy edit → sync before use",
              "Clinical question → hand off",
              "Duplicate action → execute once",
            ].map((s) => (
              <div className="ws-simple-row" key={s}>
                <span>{s}</span>
                <Pill>Planned test case</Pill>
              </div>
            ))}
          </Panel>
        </>
      ) : (
        <Panel title="A deliberate path to production">
          <div className="ws-environments">
            {["Development", "Staging", "Production"].map((e) => (
              <button
                className={env === e ? "selected" : ""}
                key={e}
                onClick={() => setEnv(e)}
              >
                <span className="ws-dot" />
                <h3>{e}</h3>
                <small>{state.release} · sample release</small>
              </button>
            ))}
          </div>
          <div className="ws-detail-grid">
            <div>
              <small>Selected environment</small>
              {env}
            </div>
            <div>
              <small>Release components</small>Next.js · API · retrieval ·
              worker
            </div>
            <div>
              <small>Infrastructure roadmap</small>AWS IAM · ECS · ECR · S3 ·
              SQS
            </div>
            <div>
              <small>Delivery roadmap</small>Linear → GitHub PR → review →
              promotion
            </div>
          </div>
          <Action
            secondary
            onClick={() =>
              update((d) => {
                d.activity.unshift(
                  `Delivery rehearsal · ${env} · ${d.release}`,
                );
              }, "Release rehearsal recorded. No infrastructure or deployment changed.")
            }
          >
            Rehearse promotion
          </Action>
        </Panel>
      )}
    </>
  );
}
function ShieldIcon() {
  return <Check size={22} />;
}
export function Portal() {
  const { state, update, open } = useStudio();
  const [clientId, setClientId] = useState("c1");
  const client = state.clients.find((c) => c.id === clientId)!;
  const [text, setText] = useState("");
  return (
    <>
      <div className="ws-toolbar">
        <p>
          Experience the practice as a client. All information is fictional.
        </p>
        <select
          aria-label="Preview as client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {state.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="ws-portal">
        <header>
          <span>{state.practice.name}</span>
          <Pill>Client preview</Pill>
        </header>
        <h1>Hello, {client.name.split(" ")[0]}.</h1>
        <p>
          A little space for your appointments, messages and practical details.
        </p>
        <div className="ws-two-column">
          <Panel title="Your next sessions">
            {state.bookings
              .filter(
                (b) =>
                  b.clientId === clientId &&
                  b.status !== "Cancelled" &&
                  b.status !== "Completed" &&
                  b.day >= demoDay,
              )
              .map((b) => (
                <div className="ws-simple-row" key={b.id}>
                  <div>
                    <strong>
                      {state.services.find((s) => s.id === b.serviceId)?.name}
                    </strong>
                    <small>
                      {b.day} · {b.time}
                    </small>
                  </div>
                  <button
                    className="ws-link"
                    onClick={() =>
                      open(
                        "Change your appointment",
                        <BookingForm booking={b} clientId={clientId} />,
                      )
                    }
                  >
                    Change time
                  </button>
                </div>
              ))}
            <Action
              secondary
              onClick={() =>
                open(
                  "Book your next session",
                  <BookingForm clientId={clientId} />,
                )
              }
            >
              Book a session
            </Action>
          </Panel>
          <Panel title="A note to your practitioner">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                update((d) => {
                  d.inbox.unshift({
                    id: uid(),
                    clientId,
                    subject: "A message from your client portal",
                    body: text,
                    status: "New",
                    reply: "",
                    messages: [],
                  });
                }, "Sample message added to the practice enquiry inbox.");
                setText("");
              }}
            >
              <Field label="Your message">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  required
                  placeholder="A practical question about your next visit…"
                />
              </Field>
              <Action type="submit">
                Send in demo <ArrowRight size={15} />
              </Action>
            </form>
          </Panel>
          <Panel title="Payments">
            {state.payments
              .filter((p) => p.clientId === clientId)
              .map((p) => (
                <div className="ws-simple-row" key={p.id}>
                  <div>
                    <strong>{p.description}</strong>
                    <small>{money(p.amount)}</small>
                  </div>
                  <Pill>{p.status}</Pill>
                  {p.status === "Pending" && (
                    <Action
                      secondary
                      onClick={() =>
                        update((d) => {
                          d.payments.find((x) => x.id === p.id)!.status =
                            "Paid";
                        }, "Payment marked paid in the sample practice. No charge made.")
                      }
                    >
                      Simulate payment
                    </Action>
                  )}
                </div>
              ))}
          </Panel>
          <Panel title="Before your visit">
            <p>{state.sources.find((s) => s.id === "k2")?.content}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
