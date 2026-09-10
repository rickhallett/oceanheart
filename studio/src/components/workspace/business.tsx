"use client";
import { useState } from "react";
import {
  Card,
  Checkbox,
  SegmentGroup,
  Switch,
  Table,
  Tabs,
  SimpleGrid,
  Stat,
} from "@chakra-ui/react";
import {
  StudioButton,
  StudioInput,
  StudioSelect,
  StudioTextarea,
} from "@/components/studio-controls";
import "./content-chakra.css";
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
        <SegmentGroup.Root
          value={device}
          onValueChange={(e) => setDevice(e.value!)}
          colorPalette="copper"
          className="ws-filter-control"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={["Desktop", "Mobile"]} />
        </SegmentGroup.Root>
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
            <StudioInput
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
            <StudioTextarea
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
            <p>Included in this template</p>
            <ul>
              <li>Service descriptions</li>
              <li>Prices and duration</li>
              <li>Booking button</li>
            </ul>
          </div>
        </Panel>
        <div
          className={`ws-site-preview ${device === "Mobile" ? "mobile" : ""}`}
        >
          <div className="ws-browser-bar">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
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
            <StudioButton
              onClick={() => open("Example client booking", <BookingForm />)}
            >
              Find a time for you <ArrowRight size={16} />
            </StudioButton>
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
function PaymentAction({ id }: { id: string }) {
  const { state, update } = useStudio();
  const p = state.payments.find((payment) => payment.id === id)!;
  return (
    <>
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
        <StudioButton
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
        </StudioButton>
      ) : (
        <span>Complete</span>
      )}
    </>
  );
}
export function Payments() {
  const { state, update } = useStudio();
  const [filter, setFilter] = useState("All");
  return (
    <>
      <div className="ws-stat-strip">
        <Stat.Root as="div">
          <Stat.Label as="span">Received</Stat.Label>
          <Stat.ValueText as="span">
            {money(
              state.payments
                .filter((p) => p.status === "Paid")
                .reduce((a, p) => a + p.amount, 0),
            )}
          </Stat.ValueText>
        </Stat.Root>
        <Stat.Root as="div">
          <Stat.Label as="span">Awaiting payment</Stat.Label>
          <Stat.ValueText as="span">
            {money(
              state.payments
                .filter((p) => p.status === "Pending")
                .reduce((a, p) => a + p.amount, 0),
            )}
          </Stat.ValueText>
        </Stat.Root>
        <Stat.Root as="div">
          <Stat.Label as="span">Connection</Stat.Label>
          <Stat.ValueText as="span" className="ws-stat-text">
            Stripe <small>sample account</small>
          </Stat.ValueText>
        </Stat.Root>
      </div>
      <div className="ws-toolbar">
        <SegmentGroup.Root
          value={filter}
          onValueChange={(e) => setFilter(e.value!)}
          colorPalette="copper"
          className="ws-filter-control"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={["All", "Paid", "Pending", "Refunded"]} />
        </SegmentGroup.Root>
        <Pill>Test data only</Pill>
      </div>
      <Panel>
        <div className="ws-mobile-records">
          {state.payments
            .filter((p) => filter === "All" || p.status === filter)
            .map((p) => (
              <Card.Root as="article" key={p.id} className="ws-mobile-record">
                <div className="ws-record-heading">
                  <h3>
                    {state.clients.find((c) => c.id === p.clientId)?.name}
                  </h3>
                  <strong className="ws-record-amount">
                    {money(p.amount)}
                  </strong>
                </div>
                <p>{p.description}</p>
                <div className="ws-record-meta">
                  <Pill tone={p.status === "Paid" ? "green" : "amber"}>
                    {p.status}
                  </Pill>
                </div>
                <div className="ws-record-action">
                  <PaymentAction id={p.id} />
                </div>
              </Card.Root>
            ))}
        </div>
        <Table.ScrollArea className="ws-desktop-records">
          <Table.Root variant="line" size="lg" className="ws-data-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Client</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Amount</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Action</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {state.payments
                .filter((p) => filter === "All" || p.status === filter)
                .map((p) => (
                  <Table.Row key={p.id}>
                    <Table.Cell>
                      <h3>
                        {state.clients.find((c) => c.id === p.clientId)?.name}
                      </h3>
                      <p>{p.description}</p>
                    </Table.Cell>
                    <Table.Cell fontWeight="semibold" textAlign="end">
                      {money(p.amount)}
                    </Table.Cell>
                    <Table.Cell>
                      <Pill tone={p.status === "Paid" ? "green" : "amber"}>
                        {p.status}
                      </Pill>
                    </Table.Cell>
                    <Table.Cell>
                      <PaymentAction id={p.id} />
                    </Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
      </Panel>
    </>
  );
}
export function Shop() {
  const { state, update, open } = useStudio();
  return (
    <>
      <div className="ws-shop-connection"><Pill>{state.connections.Shopify ? "Shopify · sample connected" : "Shopify · sample disconnected"}</Pill></div>
      <Panel title="Products" className="ws-products">
        {state.products.map((p) => (
          <div className="ws-product-row" key={p.id}>
            <h3>{p.name}</h3>
            <span>{money(p.price)}</span>
            <span className="ws-product-stock">{p.stock} available</span>
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
          </div>
        ))}
      </Panel>
      <Panel title="Orders">
        <div className="ws-mobile-records">
          {state.orders.map((o) => (
            <Card.Root as="article" key={o.id} className="ws-mobile-record">
              <h3>{o.item}</h3>
              <p>
                {o.id} · {state.clients.find((c) => c.id === o.clientId)?.name}
              </p>
              <div className="ws-record-meta">
                <Pill>{o.status}</Pill>
              </div>
              <div className="ws-record-action">
                {" "}
                <Action
                  secondary
                  disabled={o.status === "Dispatched"}
                  onClick={() =>
                    update((d) => {
                      d.orders.find((x) => x.id === o.id)!.status =
                        "Dispatched";
                    }, "Sample order marked dispatched.")
                  }
                >
                  Mark dispatched
                </Action>
              </div>
            </Card.Root>
          ))}
        </div>
        <Table.ScrollArea className="ws-desktop-records">
          <Table.Root size="lg" className="ws-data-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Order</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Action</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {state.orders.map((o) => (
                <Table.Row key={o.id}>
                  <Table.Cell>
                    <strong>
                      {o.id} · {o.item}
                    </strong>
                    <small>
                      {state.clients.find((c) => c.id === o.clientId)?.name}
                    </small>
                  </Table.Cell>
                  <Table.Cell>
                    <Pill>{o.status}</Pill>
                  </Table.Cell>
                  <Table.Cell>
                    <Action
                      secondary
                      disabled={o.status === "Dispatched"}
                      onClick={() =>
                        update((d) => {
                          d.orders.find((x) => x.id === o.id)!.status =
                            "Dispatched";
                        }, "Sample order marked dispatched.")
                      }
                    >
                      Mark dispatched
                    </Action>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
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
        <Card.Root variant="subtle" className="ws-bubble" key={i}>
          <p>{m}</p>
        </Card.Root>
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
          <StudioTextarea
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
        <StudioInput name="title" required />
      </Field>
      <Field label="Details">
        <StudioTextarea name="body" rows={5} required />
      </Field>
      <Action type="submit">Create sample request</Action>
    </form>
  );
}
export function Support() {
  const { state, open } = useStudio();
  return (
    <>
      <div className="ws-toolbar ws-support-toolbar">
        <span>Support requests</span>
        <Action onClick={() => open("Ask your studio partner", <TicketForm />)}>
          <Plus size={15} /> Start a request
        </Action>
      </div>
      <Panel className="ws-support-list">
        {state.tickets.map((t) => (
          <StudioButton
            className="ws-source-row ws-support-row"
            key={t.id}
            onClick={() => open(t.title, <TicketThread id={t.id} />, "reading")}
          >
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
          </StudioButton>
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
          <StudioButton
            key={v}
            className={step === i ? "active" : ""}
            onClick={() => setStep(i)}
          >
            <span>{i < step ? <Check size={13} /> : i + 1}</span>
            {v}
          </StudioButton>
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
              <StudioTextarea
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
            <h1>What would you like to set up?</h1>
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
                  <Checkbox.Root
                    key={f.id}
                    colorPalette="copper"
                    checked={state.priorities[f.id] === "Essential"}
                    onCheckedChange={(e) =>
                      update((d) => {
                        d.priorities[f.id] =
                          e.checked === true ? "Essential" : "Later";
                      })
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>
                      <strong>{f.title}</strong>
                      <small>{f.description}</small>
                    </Checkbox.Label>
                  </Checkbox.Root>
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
            <h1>Practice details</h1>
            <Field label="Practice name">
              <StudioInput
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Your first name">
              <StudioInput
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </Field>
            <Field label="Your work">
              <StudioInput
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
    <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} className="ws-two-column">
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
              <StudioInput
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
              <Switch.Root
                colorPalette="copper"
                checked={connected}
                onCheckedChange={() =>
                  update(
                    (d) => {
                      d.connections[name] = !connected;
                    },
                    `${name} sample connection ${connected ? "disabled" : "enabled"}. No account access changed.`,
                  )
                }
              >
                <Switch.HiddenInput aria-label={`${name} sample connection`} />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </div>
          ))}
          <p className="ws-help">
            These switches simulate connection state. No account authorisation
            or API requests take place.
          </p>
        </Panel>
        <Panel title="Sample data" className="ws-sample-settings">
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
                </div>, "compact",
              )
            }
          >
            Reset demo
          </Action>
        </Panel>
      </div>
    </SimpleGrid>
  );
}
export function Roadmap() {
  const { state, update, go } = useStudio();
  const [filter, setFilter] = useState<Priority | "All">("All");
  function exportPlan() {
    const text = JSON.stringify(
      {
        project: "oceanheart Studio",
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
          <StudioButton
            className={filter === p ? "selected" : ""}
            aria-pressed={filter === p}
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
          </StudioButton>
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
                <StudioSelect
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
                </StudioSelect>
              </div>
              <Card.Root variant="subtle" className="ws-roadmap-journey">
                {f.journey}
              </Card.Root>
              {f.dependencies.length > 0 && (
                <p className="ws-dependencies">
                  Depends on:{" "}
                  {f.dependencies
                    .map((id) => modules.find((m) => m[0] === id)?.[1])
                    .join(", ")}
                </p>
              )}
              <div className="ws-roadmap-bottom">
                <StudioInput
                  aria-label={`${f.title} roadmap note`}
                  placeholder="What would make this useful? What can wait?"
                  value={state.featureNotes[f.id] || ""}
                  onChange={(e) =>
                    update((d) => {
                      d.featureNotes[f.id] = e.target.value;
                    })
                  }
                />
                <StudioButton className="ws-link" onClick={() => go(f.id)}>
                  Try this feature <ArrowRight size={14} />
                </StudioButton>
              </div>
            </Panel>
          ))}
      </div>
    </>
  );
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
        <StudioSelect
          aria-label="Preview as client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {state.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </StudioSelect>
      </div>
      <div className="ws-portal">
        <header>
          <span>{state.practice.name}</span>
          <Pill>Client preview</Pill>
        </header>
        <h1>Hello, {client.name.split(" ")[0]}.</h1>
        <p>
          View your appointments, messages and practice details.
        </p>
        <SimpleGrid
          columns={{ base: 1, md: 2 }}
          gap={6}
          className="ws-two-column"
        >
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
                  <StudioButton
                    className="ws-link"
                    onClick={() =>
                      open(
                        "Change your appointment",
                        <BookingForm booking={b} clientId={clientId} />,
                      )
                    }
                  >
                    Change time
                  </StudioButton>
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
                <StudioTextarea
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
        </SimpleGrid>
      </div>
    </>
  );
}
