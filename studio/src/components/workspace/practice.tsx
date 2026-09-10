"use client";
import { useState } from "react";
import {
  Card,
  Checkbox,
  SegmentGroup,
  Table,
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
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  MessageCircle,
  ArrowUpRight,
  Search,
} from "lucide-react";
import {
  useStudio,
  Panel,
  Pill,
  Empty,
  Action,
  Field,
  Avatar,
} from "./context";
import {
  demoDay,
  money,
  uid,
  type Booking,
  type Client,
  type Message,
  type Service,
} from "./model";

export function BookingForm({
  booking,
  clientId,
}: {
  booking?: Booking;
  clientId?: string;
}) {
  const { state, update, close } = useStudio();
  const [error, setError] = useState("");
  const available = state.services.filter(
    (s) => s.active || s.id === booking?.serviceId,
  );
  const terminal =
    booking?.status === "Completed" || booking?.status === "Cancelled";
  return (
    <form
      className="ws-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const next: Booking = {
          id: booking?.id || uid(),
          clientId: booking?.clientId || clientId || String(f.get("client")),
          serviceId: booking?.serviceId || String(f.get("service")),
          day: String(f.get("day")),
          time: String(f.get("time")),
          status: booking?.status || "Confirmed",
        };
        const service = state.services.find((s) => s.id === next.serviceId);
        if (
          terminal ||
          !service ||
          (!booking && !service.active) ||
          !state.clients.some((c) => c.id === next.clientId)
        ) {
          setError(
            terminal
              ? "Completed or cancelled sessions cannot be rescheduled."
              : "Choose an available service and client before booking.",
          );
          return;
        }
        const minutes = (t: string) =>
          Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
        const start = minutes(next.time);
        if (
          state.bookings.some(
            (b) =>
              b.id !== next.id &&
              b.day === next.day &&
              b.status !== "Cancelled" &&
              start <
                minutes(b.time) +
                  (state.services.find((s) => s.id === b.serviceId)?.duration ||
                    60) &&
              start + service.duration > minutes(b.time),
          )
        ) {
          setError(
            "That time overlaps another booking. Choose a different time.",
          );
          return;
        }
        update(
          (d) => {
            if (booking)
              d.bookings = d.bookings.map((b) =>
                b.id === booking.id ? next : b,
              );
            else {
              d.bookings.push(next);
              if (service.price > 0)
                d.payments.push({
                  id: uid(),
                  clientId: next.clientId,
                  description: `${service.name} · ${next.day}`,
                  amount: service.price,
                  status: "Pending",
                });
            }
            if (!booking)
              d.clients.find((c) => c.id === next.clientId)!.status = "Active";
            d.activity.unshift(
              `${booking ? "Rescheduled" : "Booked"} · ${service.name} · ${next.day} ${next.time}`,
            );
          },
          booking
            ? "Booking rescheduled in the demo."
            : "Session booked in the demo.",
        );
        close();
      }}
    >
      <Field label="Client">
        <StudioSelect
          name="client"
          disabled={!!booking || !!clientId}
          defaultValue={booking?.clientId || clientId || state.clients[0]?.id}
        >
          {state.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </StudioSelect>
      </Field>
      <Field label="Service">
        <StudioSelect
          name="service"
          disabled={!!booking || available.length === 0}
          defaultValue={
            booking?.serviceId ||
            (clientId &&
            state.clients.find((c) => c.id === clientId)?.status ===
              "New enquiry"
              ? "s2"
              : undefined)
          }
        >
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.duration} min · {money(s.price)}
            </option>
          ))}
        </StudioSelect>
      </Field>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} className="ws-form-grid">
        <Field label="Date">
          <StudioInput
            name="day"
            type="date"
            required
            defaultValue={booking?.day || demoDay}
          />
        </Field>
        <Field label="Time">
          <StudioInput
            name="time"
            type="time"
            required
            defaultValue={booking?.time || "15:00"}
          />
        </Field>
      </SimpleGrid>
      {available.length === 0 && (
        <p role="alert">Add or show a service before booking a session.</p>
      )}
      {terminal && (
        <p role="alert">
          Completed or cancelled sessions cannot be rescheduled.
        </p>
      )}
      {error && (
        <p role="alert" className="ws-error">
          {error}
        </p>
      )}
      <p className="ws-help">
        Creates a sample booking only. No calendar invitation or payment request
        is sent.
      </p>
      <Action
        type="submit"
        disabled={
          terminal || available.length === 0 || state.clients.length === 0
        }
      >
        {booking ? "Save new time" : "Confirm booking"} <ArrowRight size={16} />
      </Action>
    </form>
  );
}
function BookingDetail({ id }: { id: string }) {
  const { state, update, open, close } = useStudio();
  const b = state.bookings.find((b) => b.id === id)!;
  const c = state.clients.find((c) => c.id === b.clientId)!;
  const s = state.services.find((s) => s.id === b.serviceId)!;
  return (
    <div className="ws-form">
      <div className="ws-person">
        <Avatar name={c.name} />
        <div>
          <h3>{c.name}</h3>
          <p>{c.email}</p>
        </div>
      </div>
      <SimpleGrid
        as="dl"
        columns={{ base: 1, md: 2 }}
        gap={6}
        className="ws-detail-grid ws-session-facts"
      >
        <div>
          <dt>Session</dt>
          <dd>{s.name}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{b.day} · {b.time}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{s.duration} minutes</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{money(s.price)}</dd>
        </div>
      </SimpleGrid>
      <Pill>{b.status}</Pill>
      <div className="ws-actions">
        <Action
          disabled={b.status === "Completed" || b.status === "Cancelled"}
          onClick={() =>
            open("Reschedule session", <BookingForm booking={b} />)
          }
        >
          Reschedule
        </Action>
        <Action
          secondary
          disabled={b.status === "Completed" || b.status === "Cancelled"}
          onClick={() => {
            update((d) => {
              d.bookings.find((x) => x.id === id)!.status = "Completed";
              d.activity.unshift(`Completed · ${c.name} · ${s.name}`);
            }, "Session marked complete.");
            close();
          }}
        >
          Mark complete
        </Action>
        <Action
          secondary
          disabled={b.status === "Cancelled"}
          onClick={() => {
            update((d) => {
              d.bookings.find((x) => x.id === id)!.status = "Cancelled";
            }, "Sample booking cancelled.");
            close();
          }}
        >
          Cancel booking
        </Action>
      </div>
    </div>
  );
}
export function Agenda({ day = demoDay }: { day?: string }) {
  const { state, open } = useStudio();
  const rows = state.bookings
    .filter((b) => b.day === day && b.status !== "Cancelled")
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div className="ws-agenda">
      {rows.length ? (
        rows.map((b) => {
          const c = state.clients.find((c) => c.id === b.clientId)!;
          const s = state.services.find((s) => s.id === b.serviceId)!;
          return (
            <StudioButton
              className="ws-agenda-row"
              key={b.id}
              onClick={() =>
                open("Session details", <BookingDetail id={b.id} />, "reading")
              }
            >
              <time>{b.time}</time>
              <span
                className={`ws-dot ${b.status === "Completed" ? "muted" : ""}`}
              />
              <div>
                <strong>{c.name}</strong>
                <small>
                  {s.name} · {s.duration} min
                </small>
              </div>
              <Pill tone={b.status === "Completed" ? "green" : ""}>
                {b.status}
              </Pill>
              <ChevronRight size={17} />
            </StudioButton>
          );
        })
      ) : (
        <Empty
          title="No sessions scheduled"
          body="No sessions on this day. Add a booking when you’re ready."
        />
      )}
    </div>
  );
}
export function Today() {
  const { state, go, open, update } = useStudio();
  const bookings = state.bookings.filter(
    (b) => b.day === demoDay && b.status !== "Cancelled",
  );
  const pending = state.approvals.filter((a) => a.status === "Pending").length;
  return (
    <>
      <div className="ws-welcome">
        <div>
          <p className="ws-date-label">Tuesday, 8 September · a sample day</p>
          <h1>Good morning, {state.practice.owner}.</h1>
          <p>
            You have {bookings.length} {bookings.length === 1 ? "session" : "sessions"} today.
          </p>
        </div>
        <Action onClick={() => open("Book a session", <BookingForm />)}>
          <Plus size={17} /> New booking
        </Action>
      </div>
      {pending > 0 && (
        <StudioButton
          className="ws-approval-banner"
          onClick={() => go("assistant")}
        >
          <span className="ws-dot" />
          {pending} action{pending > 1 ? "s" : ""} waiting for your review{" "}
          <ArrowRight size={16} />
        </StudioButton>
      )}
      <SimpleGrid
        columns={{ base: 1, md: 2 }}
        gap={6}
        className="ws-dashboard-grid ws-today-work"
      >
        <Panel
          title="Schedule"
          action={
            <StudioButton className="ws-link" onClick={() => go("calendar")}>
              View calendar <ArrowUpRight size={15} />
            </StudioButton>
          }
        >
          <Agenda />
          <div className="ws-agenda-footer">
            <Clock size={15} /> 16:30 · Notes and preparation
          </div>
        </Panel>
        <Panel title="Tasks">
          <TaskList limit={4} />
          <StudioButton
            className="ws-link ws-panel-footer"
            onClick={() => go("tasks")}
          >
            All your tasks <ArrowRight size={15} />
          </StudioButton>
        </Panel>
      </SimpleGrid>
      <div className="ws-stat-strip">
        <Stat.Root asChild>
          <StudioButton onClick={() => go("calendar")}>
            <Stat.Label as="span">Appointments</Stat.Label>
            <Stat.ValueText as="span">
              {bookings.length} <small>sessions today</small>
            </Stat.ValueText>
          </StudioButton>
        </Stat.Root>
        <Stat.Root asChild>
          <StudioButton onClick={() => go("inbox")}>
            <Stat.Label as="span">New enquiries</Stat.Label>
            <Stat.ValueText as="span">
              {state.inbox.filter((m) => m.status === "New").length}{" "}
              <small>new enquiries</small>
            </Stat.ValueText>
          </StudioButton>
        </Stat.Root>
        <Stat.Root asChild>
          <StudioButton onClick={() => go("payments")}>
            <Stat.Label as="span">Payments received</Stat.Label>
            <Stat.ValueText as="span">
              {money(
                state.payments
                  .filter((p) => p.status === "Paid")
                  .reduce((a, p) => a + p.amount, 0),
              )}{" "}
              <small>received</small>
            </Stat.ValueText>
          </StudioButton>
        </Stat.Root>
      </div>

      <SimpleGrid
        columns={{ base: 1, md: 2 }}
        gap={6}
        className="ws-today-secondary"
      >
        <Panel
          title="Latest enquiry"
          className="ws-secondary-panel"
        >
          <StudioButton
            className="ws-conversation-preview"
            onClick={() => go("inbox")}
          >
            <Avatar name="Sophie Ellis" />
            <div>
              <h3>A first appointment</h3>
              <p>
                “I’ve never tried reflexology before. Could we have a quick
                conversation before I book?”
              </p>
              <small>Sophie Ellis · New enquiry</small>
            </div>
            <ArrowUpRight size={18} />
          </StudioButton>
        </Panel>
        <Panel
          title="Support"
          className="ws-partner-panel ws-secondary-panel"
        >
          <span className="ws-partner-initial">R</span>
          <h3>
            Practice support
          </h3>
          <p>Something not quite working? Tell Rick what’s on your mind.</p>
          <StudioButton className="ws-link" onClick={() => go("support")}>
            Open your conversation <ArrowRight size={15} />
          </StudioButton>
        </Panel>
      </SimpleGrid>

    </>
  );
}
export function TaskList({ limit }: { limit?: number }) {
  const { state, update } = useStudio();
  return (
    <div className="ws-tasks">
      {state.tasks.slice(0, limit).map((t) => (
        <Checkbox.Root
          key={t.id}
          className={t.done ? "is-done" : ""}
          colorPalette="copper"
          checked={t.done}
          onCheckedChange={() =>
            update((d) => {
              d.tasks.find((x) => x.id === t.id)!.done = !t.done;
            })
          }
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Label>{t.text}</Checkbox.Label>
        </Checkbox.Root>
      ))}
    </div>
  );
}
export function Tasks() {
  const { state, update } = useStudio();
  const [text, setText] = useState("");
  return (
    <Panel
      title={`${state.tasks.filter((t) => !t.done).length} things to come back to`}
    >
      <TaskList />
      <form
        className="ws-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          update((d) => {
            d.tasks.push({ id: uid(), text: text.trim(), done: false });
          }, "Task added.");
          setText("");
        }}
      >
        <StudioInput
          aria-label="New task"
          placeholder="Something else on your mind…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <Action type="submit">
          <Plus size={16} /> Add task
        </Action>
      </form>
    </Panel>
  );
}
export function Calendar() {
  const { open } = useStudio();
  const [day, setDay] = useState(demoDay);
  const [mode, setMode] = useState("Week");
  const monday = new Date(day + "T12:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  function move(n: number) {
    const date = new Date(day + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + n);
    setDay(date.toISOString().slice(0, 10));
  }
  return (
    <>
      <div className="ws-toolbar">
        <SegmentGroup.Root
          value={mode}
          onValueChange={(e) => setMode(e.value!)}
          colorPalette="copper"
          className="ws-filter-control"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={["Day", "Week"]} />
        </SegmentGroup.Root>
        <div className="ws-date-control">
          <StudioButton aria-label="Previous day" onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </StudioButton>
          <StudioInput
            aria-label="Calendar date"
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
          <StudioButton aria-label="Next day" onClick={() => move(1)}>
            <ChevronRight size={18} />
          </StudioButton>
        </div>
        <Action onClick={() => open("Book a session", <BookingForm />)}>
          <Plus size={16} /> New booking
        </Action>
      </div>
      {mode === "Week" && (
        <div className="ws-week">
          {dates.map((d) => (
            <StudioButton
              key={d}
              className={d === day ? "selected" : ""}
              onClick={() => setDay(d)}
            >
              <span>
                {new Date(d + "T12:00Z").toLocaleDateString("en-GB", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </span>
              <strong>{Number(d.slice(-2))}</strong>
            </StudioButton>
          ))}
        </div>
      )}
      <Panel
        title={new Date(day + "T12:00Z").toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })}
      >
        <Agenda day={day} />
      </Panel>
    </>
  );
}
function ClientForm() {
  const { update, close } = useStudio();
  return (
    <form
      className="ws-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        update((d) => {
          d.clients.push({
            id: uid(),
            name: String(f.get("name")).trim(),
            email: String(f.get("email")),
            phone: String(f.get("phone")),
            status: "New",
            notes: [],
          });
        }, "Sample client added.");
        close();
      }}
    >
      <Field label="Full name">
        <StudioInput name="name" required />
      </Field>
      <Field label="Email">
        <StudioInput name="email" type="email" required />
      </Field>
      <Field label="Phone">
        <StudioInput name="phone" type="tel" />
      </Field>
      <p className="ws-help">
        Use fictional information in this public prototype.
      </p>
      <Action type="submit">Add client</Action>
    </form>
  );
}
export function ClientDetail({ id }: { id: string }) {
  const { state, update, open } = useStudio();
  const [note, setNote] = useState("");
  const c = state.clients.find((c) => c.id === id)!;
  const bookings = state.bookings.filter((b) => b.clientId === id);
  return (
    <div className="ws-form ws-client-detail">
      <div className="ws-person">
        <Avatar name={c.name} />
        <div>
          <h3>{c.name}</h3>
          <div className="ws-client-contact">
            <span>{c.email}</span>
            {c.phone && <span>{c.phone}</span>}
          </div>
        </div>
      </div>
      <Pill>{c.status}</Pill>
      <h3>Session history</h3>
      {bookings.length ? (
        bookings.map((b) => (
          <div className="ws-simple-row ws-client-session" key={b.id}>
            <span>
              <span className="ws-client-session-date">{b.day} · {b.time}</span>
              <small>
                {state.services.find((s) => s.id === b.serviceId)?.name}
              </small>
            </span>
            <Pill>{b.status}</Pill>
          </div>
        ))
      ) : (
        <p className="ws-help">
          No sessions yet. A first conversation is a good place to start.
        </p>
      )}
      <Action
        secondary
        onClick={() => open("Book a session", <BookingForm clientId={id} />)}
      >
        Book a session
      </Action>
      <h3>Practical notes</h3>
      {c.notes.map((n, i) => (
        <p className="ws-note" key={i}>
          {n}
        </p>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          update((d) => {
            d.clients.find((c) => c.id === id)!.notes.push(note.trim());
          }, "Note saved in this browser.");
          setNote("");
        }}
      >
        <Field label="Add a practical note">
          <StudioTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Preferences or arrangements. Use fictional data, not clinical records."
            required
          />
        </Field>
        <Action type="submit">Save note</Action>
      </form>
    </div>
  );
}
export function Clients() {
  const { state, open } = useStudio();
  const [q, setQ] = useState("");
  const rows = state.clients.filter((c) =>
    (c.name + " " + c.email).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="ws-toolbar">
        <div className="ws-search">
          <Search size={17} />
          <StudioInput
            aria-label="Search clients"
            placeholder="Find a person…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Action onClick={() => open("Add a client", <ClientForm />)}>
          <Plus size={16} /> Add client
        </Action>
      </div>
      <Panel>
        <div className="ws-mobile-records">
          {rows.map((c) => (
            <Card.Root as="article" key={c.id} className="ws-mobile-record">
              <StudioButton
                className="ws-record-title"
                onClick={() => open(c.name, <ClientDetail id={c.id} />, "editor")}
              >
                <Avatar name={c.name} />
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.email}</small>
                </span>
                <ChevronRight size={17} />
              </StudioButton>
              <div className="ws-record-meta">
                <span>
                  {state.bookings.filter((b) => b.clientId === c.id).length}{" "}
                  sessions
                </span>
                <Pill>{c.status}</Pill>
              </div>
            </Card.Root>
          ))}
        </div>
        <Table.ScrollArea className="ws-desktop-records">
          <Table.Root variant="line" size="lg" className="ws-data-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Client</Table.ColumnHeader>
                <Table.ColumnHeader>Sessions</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((c) => (
                <Table.Row key={c.id}>
                  <Table.Cell>
                    <StudioButton
                      variant="ghost"
                      className="ws-person ws-table-person"
                      onClick={() => open(c.name, <ClientDetail id={c.id} />, "editor")}
                    >
                      <Avatar name={c.name} />
                      <span>
                        <strong>{c.name}</strong>
                        <small>{c.email}</small>
                      </span>
                      <ChevronRight size={17} />
                    </StudioButton>
                  </Table.Cell>
                  <Table.Cell>
                    {state.bookings.filter((b) => b.clientId === c.id).length}
                  </Table.Cell>
                  <Table.Cell>
                    <Pill>{c.status}</Pill>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
        {!rows.length && (
          <Empty
            title="No matching clients"
            body="Try a different name or add a sample client."
          />
        )}
      </Panel>
    </>
  );
}
function Conversation({ id }: { id: string }) {
  const { state, update, open } = useStudio();
  const m = state.inbox.find((m) => m.id === id)!;
  const c = state.clients.find((c) => c.id === m.clientId)!;
  const [draft, setDraft] = useState(m.reply);
  function generate() {
    const reply =
      m.id === "m1"
        ? `Hi ${c.name.split(" ")[0]}, thank you for getting in touch. A first conversation is a lovely place to start. It’s a free 20-minute call. Would Thursday at 11:00 work for you?`
        : m.id === "m2"
          ? `Hi ${c.name.split(" ")[0]}, thank you for your enquiry. The listed session price covers our time together. Let me know which appointment you would like.`
          : `Hi ${c.name.split(" ")[0]}, your joining link is included in your booking confirmation. If you can’t find it, I’ll help before the session.`;
    setDraft(reply);
    update((d) => {
      const x = d.inbox.find((x) => x.id === id)!;
      x.reply = reply;
      x.status = "Draft ready";
    }, "Example draft prepared for your review.");
  }
  return (
    <div className="ws-thread">
      <header>
        <div className="ws-person">
          <Avatar name={c.name} />
          <div>
            <h2>{m.subject}</h2>
            <p>
              {c.name} · {c.email}
            </p>
          </div>
        </div>
        <Pill>{m.status}</Pill>
      </header>
      <Card.Root variant="subtle" className="ws-bubble">
        <small>{c.name} · Website enquiry</small>
        <p>{m.body}</p>
      </Card.Root>
      {m.messages.map((text, i) => (
        <Card.Root variant="subtle" className="ws-bubble outgoing" key={i}>
          <small>You · simulated reply</small>
          <p>{text}</p>
        </Card.Root>
      ))}
      <div className="ws-thread-actions">
        <Action secondary onClick={generate}>
          Prepare example reply
        </Action>
        <Action
          secondary
          onClick={() =>
            open("Book a first conversation", <BookingForm clientId={c.id} />)
          }
        >
          Book a session
        </Action>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          update((d) => {
            if (
              d.approvals.some(
                (a) =>
                  a.type === "reply" &&
                  a.messageId === id &&
                  a.status !== "Declined",
              )
            )
              return;
            d.inbox.find((x) => x.id === id)!.reply = draft;
            d.approvals.push({
              id: uid(),
              title: `Reply to ${c.name}`,
              detail: draft,
              type: "reply",
              messageId: id,
              status: "Pending",
            });
          }, "Reply added to Assistant → Needs your approval.");
        }}
      >
        <Field label="Your reply">
          <StudioTextarea
            rows={5}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              update((d) => {
                d.inbox.find((x) => x.id === id)!.reply = e.target.value;
              });
            }}
            placeholder="Write a reply, or try the example draft…"
            required
          />
        </Field>
        <p className="ws-source-hint">
          Example draft source:{" "}
          {m.id === "m3" ? "Your first visit" : "Booking & cancellation policy"}{" "}
          · review before approving
        </p>
        <Action
          type="submit"
          disabled={state.approvals.some(
            (a) =>
              a.type === "reply" &&
              a.messageId === id &&
              a.status !== "Declined",
          )}
        >
          Send to approval queue <ArrowRight size={16} />
        </Action>
      </form>
    </div>
  );
}
export function Inbox() {
  const { state } = useStudio();
  const [selected, setSelected] = useState(state.inbox[0].id);
  const [filter, setFilter] = useState("All");
  const [mobileDetail, setMobileDetail] = useState(false);
  return (
    <div className={`ws-inbox ${mobileDetail ? "ws-inbox-detail-open" : ""}`}>
      <aside className="ws-inbox-list">
        <SegmentGroup.Root
          value={filter}
          onValueChange={(e) => setFilter(e.value!)}
          colorPalette="copper"
          className="ws-filter-control"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items items={["All", "New", "Replied"]} />
        </SegmentGroup.Root>
        {state.inbox
          .filter((m) => filter === "All" || m.status === filter)
          .map((m) => (
            <StudioButton
              className={`ws-inbox-item ${selected === m.id ? "active" : ""}`}
              key={m.id}
              onClick={() => {
                setSelected(m.id);
                setMobileDetail(true);
              }}
            >
              <span>
                <strong>
                  {state.clients.find((c) => c.id === m.clientId)?.name}
                </strong>
                <span className={m.status === "New" ? "ws-dot" : ""} />
              </span>
              <h3>{m.subject}</h3>
              <p>{m.body}</p>
              <small>{m.status}</small>
            </StudioButton>
          ))}
      </aside>
      <div className="ws-inbox-detail">
        <StudioButton
          className="ws-inbox-back"
          onClick={() => setMobileDetail(false)}
        >
          <ChevronLeft size={17} /> Back to enquiries
        </StudioButton>
        <Conversation key={selected} id={selected} />
      </div>
    </div>
  );
}
function ServiceForm({ service }: { service?: Service }) {
  const { update, close } = useStudio();
  return (
    <form
      className="ws-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = {
          id: service?.id || uid(),
          name: String(f.get("name")),
          duration: Number(f.get("duration")),
          price: Number(f.get("price")),
          description: String(f.get("description")),
          active: service?.active ?? true,
        };
        update((d) => {
          if (service)
            d.services = d.services.map((x) => (x.id === s.id ? s : x));
          else d.services.push(s);
        }, "Service updated across bookings and your website preview.");
        close();
      }}
    >
      <Field label="Service name">
        <StudioInput name="name" required defaultValue={service?.name} />
      </Field>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} className="ws-form-grid">
        <Field label="Duration (minutes)">
          <StudioInput
            name="duration"
            type="number"
            min="5"
            max="480"
            required
            defaultValue={service?.duration || 60}
          />
        </Field>
        <Field label="Price (£)">
          <StudioInput
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={service?.price || 0}
          />
        </Field>
      </SimpleGrid>
      <Field label="Description">
        <StudioTextarea
          name="description"
          defaultValue={service?.description}
          required
        />
      </Field>
      <Action type="submit">Save service</Action>
    </form>
  );
}
export function Services() {
  const { state, open, update } = useStudio();
  return (
    <>
      <div className="ws-toolbar">
        <p>Services are shared by your booking calendar and website.</p>
        <Action onClick={() => open("Add a service", <ServiceForm />)}>
          <Plus size={16} /> New service
        </Action>
      </div>
      <SimpleGrid
        columns={{ base: 1, md: 3 }}
        gap={6}
        className="ws-service-grid"
      >
        {state.services.map((s) => (
          <Panel key={s.id}>
            <div className="ws-service-icon">
              <CalendarDays size={24} />
            </div>
            <Pill tone={s.active ? "green" : ""}>
              {s.active ? "Available" : "Hidden"}
            </Pill>
            <h2>{s.name}</h2>
            <p>{s.description}</p>
            <div className="ws-price">
              {money(s.price)}
              <small> / {s.duration} minutes</small>
            </div>
            <div className="ws-actions">
              <Action
                secondary
                onClick={() =>
                  open("Edit service", <ServiceForm service={s} />)
                }
              >
                Edit details
              </Action>
              <StudioButton
                className="ws-link"
                onClick={() =>
                  update((d) => {
                    d.services.find((x) => x.id === s.id)!.active = !s.active;
                  })
                }
              >
                {s.active ? "Hide service" : "Make available"}
              </StudioButton>
            </div>
          </Panel>
        ))}
      </SimpleGrid>
    </>
  );
}
