"use client";
import { useState } from "react";
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
        <select
          name="client"
          disabled={!!booking || !!clientId}
          defaultValue={booking?.clientId || clientId || state.clients[0]?.id}
        >
          {state.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Service">
        <select
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
        </select>
      </Field>
      <div className="ws-form-grid">
        <Field label="Date">
          <input
            name="day"
            type="date"
            required
            defaultValue={booking?.day || demoDay}
          />
        </Field>
        <Field label="Time">
          <input
            name="time"
            type="time"
            required
            defaultValue={booking?.time || "15:00"}
          />
        </Field>
      </div>
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
      <div className="ws-detail-grid">
        <div>
          <small>Session</small>
          {s.name}
        </div>
        <div>
          <small>When</small>
          {b.day} · {b.time}
        </div>
        <div>
          <small>Duration</small>
          {s.duration} minutes
        </div>
        <div>
          <small>Price</small>
          {money(s.price)}
        </div>
      </div>
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
            <button
              className="ws-agenda-row"
              key={b.id}
              onClick={() =>
                open("Session details", <BookingDetail id={b.id} />)
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
            </button>
          );
        })
      ) : (
        <Empty
          title="A little breathing room"
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
            You have {bookings.length} sessions today. There’s room to take a
            breath.
          </p>
        </div>
        <Action onClick={() => open("Book a session", <BookingForm />)}>
          <Plus size={17} /> New booking
        </Action>
      </div>
      <div className="ws-stat-strip">
        <button onClick={() => go("calendar")}>
          <span>On the calendar</span>
          <strong>
            {bookings.length} <small>sessions today</small>
          </strong>
        </button>
        <button onClick={() => go("inbox")}>
          <span>Waiting for you</span>
          <strong>
            {state.inbox.filter((m) => m.status === "New").length}{" "}
            <small>new enquiries</small>
          </strong>
        </button>
        <button onClick={() => go("payments")}>
          <span>This week, so far</span>
          <strong>
            {money(
              state.payments
                .filter((p) => p.status === "Paid")
                .reduce((a, p) => a + p.amount, 0),
            )}{" "}
            <small>received</small>
          </strong>
        </button>
      </div>
      <div className="ws-dashboard-grid">
        <Panel
          title="Your day"
          action={
            <button className="ws-link" onClick={() => go("calendar")}>
              View calendar <ArrowUpRight size={15} />
            </button>
          }
        >
          <Agenda />
          <div className="ws-agenda-footer">
            <Clock size={15} /> 16:30 · A little time for notes and tomorrow
          </div>
        </Panel>
        <Panel title="A few next steps">
          <TaskList limit={4} />
          <button
            className="ws-link ws-panel-footer"
            onClick={() => go("tasks")}
          >
            All your tasks <ArrowRight size={15} />
          </button>
        </Panel>
        <Panel title="A conversation to come back to">
          <button
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
          </button>
        </Panel>
        <Panel title="Your studio partner" className="ws-partner-panel">
          <span className="ws-partner-initial">R</span>
          <h3>
            A familiar person.
            <br />A little less to carry.
          </h3>
          <p>Something not quite working? Tell Rick what’s on your mind.</p>
          <button className="ws-link" onClick={() => go("support")}>
            Open your conversation <ArrowRight size={15} />
          </button>
        </Panel>
      </div>
      {pending > 0 && (
        <button className="ws-approval-banner" onClick={() => go("assistant")}>
          <span className="ws-dot" />
          {pending} action{pending > 1 ? "s" : ""} waiting for your review{" "}
          <ArrowRight size={16} />
        </button>
      )}
      <div className="ws-journey">
        <div>
          <h3>Take the practice for a spin.</h3>
          <p>
            Start with Sophie’s enquiry. Draft a reply, approve it, then book
            her first conversation.
          </p>
        </div>
        <Action secondary onClick={() => go("inbox")}>
          Try the journey <ArrowRight size={16} />
        </Action>
      </div>
    </>
  );
}
export function TaskList({ limit }: { limit?: number }) {
  const { state, update } = useStudio();
  return (
    <div className="ws-tasks">
      {state.tasks.slice(0, limit).map((t) => (
        <label key={t.id} className={t.done ? "is-done" : ""}>
          <input
            type="checkbox"
            checked={t.done}
            onChange={() =>
              update((d) => {
                d.tasks.find((x) => x.id === t.id)!.done = !t.done;
              })
            }
          />
          <span>{t.text}</span>
        </label>
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
        <input
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
        <div className="ws-segment">
          {["Day", "Week"].map((v) => (
            <button
              key={v}
              aria-pressed={mode === v}
              onClick={() => setMode(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="ws-date-control">
          <button aria-label="Previous day" onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </button>
          <input
            aria-label="Calendar date"
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
          <button aria-label="Next day" onClick={() => move(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
        <Action onClick={() => open("Book a session", <BookingForm />)}>
          <Plus size={16} /> New booking
        </Action>
      </div>
      {mode === "Week" && (
        <div className="ws-week">
          {dates.map((d) => (
            <button
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
              <span className="ws-dot" />
            </button>
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
      <p className="ws-footnote">
        Sample calendar · bookings are shared with Today and client histories.
        Availability rules can be explored in Settings.
      </p>
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
        <input name="name" required />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required />
      </Field>
      <Field label="Phone">
        <input name="phone" type="tel" />
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
    <div className="ws-form">
      <div className="ws-person">
        <Avatar name={c.name} />
        <div>
          <h3>{c.name}</h3>
          <p>
            {c.email} · {c.phone}
          </p>
        </div>
      </div>
      <Pill>{c.status}</Pill>
      <h3>Session history</h3>
      {bookings.length ? (
        bookings.map((b) => (
          <div className="ws-simple-row" key={b.id}>
            <span>
              {b.day} · {b.time}
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
          <textarea
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
          <input
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
        <div className="ws-table-heading">
          <span>Client</span>
          <span>Sessions</span>
          <span>Status</span>
        </div>
        {rows.map((c) => (
          <button
            key={c.id}
            className="ws-client-row"
            onClick={() => open(c.name, <ClientDetail id={c.id} />)}
          >
            <div className="ws-person">
              <Avatar name={c.name} />
              <div>
                <strong>{c.name}</strong>
                <small>{c.email}</small>
              </div>
            </div>
            <span>
              {state.bookings.filter((b) => b.clientId === c.id).length}
            </span>
            <Pill>{c.status}</Pill>
            <ChevronRight size={17} />
          </button>
        ))}
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
          ? "Hi Lucy, of course. With at least 24 hours’ notice, there’s no charge to move your session. Let’s find a time on Friday that works for you."
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
      <div className="ws-bubble">
        <small>{c.name} · Website enquiry</small>
        <p>{m.body}</p>
      </div>
      {m.messages.map((text, i) => (
        <div className="ws-bubble outgoing" key={i}>
          <small>You · simulated reply</small>
          <p>{text}</p>
        </div>
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
        <button
          className="ws-link"
          onClick={() =>
            update((d) => {
              d.inbox.find((x) => x.id === id)!.status = "Escalated";
              d.tickets.push({
                id: "ST-" + uid().slice(0, 4),
                title: m.subject,
                status: "Open",
                messages: [`${c.name}: ${m.body}`],
              });
            }, "Conversation handed to your studio partner in the demo.")
          }
        >
          Ask Rick to help <ArrowUpRight size={14} />
        </button>
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
          <textarea
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
      <p className="ws-footnote">
        This prototype never sends email. Approved replies appear in this sample
        conversation.
      </p>
    </div>
  );
}
export function Inbox() {
  const { state } = useStudio();
  const [selected, setSelected] = useState(state.inbox[0].id);
  const [filter, setFilter] = useState("All");
  return (
    <div className="ws-inbox">
      <aside>
        <div className="ws-segment">
          {["All", "New", "Replied"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {state.inbox
          .filter((m) => filter === "All" || m.status === filter)
          .map((m) => (
            <button
              className={`ws-inbox-item ${selected === m.id ? "active" : ""}`}
              key={m.id}
              onClick={() => setSelected(m.id)}
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
            </button>
          ))}
      </aside>
      <Conversation key={selected} id={selected} />
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
        <input name="name" required defaultValue={service?.name} />
      </Field>
      <div className="ws-form-grid">
        <Field label="Duration (minutes)">
          <input
            name="duration"
            type="number"
            min="5"
            max="480"
            required
            defaultValue={service?.duration || 60}
          />
        </Field>
        <Field label="Price (£)">
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={service?.price || 0}
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
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
      <div className="ws-service-grid">
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
              <button
                className="ws-link"
                onClick={() =>
                  update((d) => {
                    d.services.find((x) => x.id === s.id)!.active = !s.active;
                  })
                }
              >
                {s.active ? "Hide service" : "Make available"}
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
