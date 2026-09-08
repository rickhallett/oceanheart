"use client";
import {
  Component,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "next/link";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import {
  ConvexReactClient,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flower2,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Mark } from "../ui";
import {
  dayWindow,
  localDate,
  practiceApi,
  readableError,
  type BookingInput,
  type Tenant,
  type TenantId,
} from "./api";

function Frame({
  children,
  account,
}: {
  children: ReactNode;
  account?: ReactNode;
}) {
  return (
    <div className="live-practice">
      <a className="lp-skip" href="#practice-content">
        Skip to your practice
      </a>
      <header className="lp-header">
        <Link className="lp-brand" href="/">
          <Mark />
          <span>
            Oceanheart <small>STUDIO</small>
          </span>
        </Link>
        <div className="lp-header-end">
          <Link href="/app">
            Explore the prototype <ArrowRight size={14} />
          </Link>
          {account}
        </div>
      </header>
      <main id="practice-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="lp-footer">
        <span>Built with care. Looked after personally.</span>
        <Link href="/#contact">
          Your studio partner <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
export function PracticeUnavailable() {
  return (
    <Frame>
      <section className="lp-welcome">
        <div className="lp-welcome-art">
          <Mark />
          <span>
            A little more space
            <br />
            for your practice.
          </span>
        </div>
        <div>
          <span className="lp-kicker">YOUR PRACTICE</span>
          <h1>Your workspace is taking shape.</h1>
          <p>
            Private practice accounts are not available on this deployment yet.
            You can explore the full sample workspace while we prepare it.
          </p>
          <Link className="lp-button" href="/app">
            Explore the sample practice <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </Frame>
  );
}
export function PracticeApp({ convexUrl }: { convexUrl: string }) {
  const [client] = useState(() => new ConvexReactClient(convexUrl));
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      <SessionGate />
    </ConvexProviderWithClerk>
  );
}
function SessionGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  return (
    <Frame account={isSignedIn ? <UserButton /> : undefined}>
      {!isLoaded || isLoading ? (
        <div className="lp-loading" role="status">
          <Mark />
          <p>Opening your practice…</p>
        </div>
      ) : !isSignedIn ? (
        <section className="lp-welcome">
          <div className="lp-welcome-art">
            <Mark />
            <span>
              A calmer day
              <br />
              starts here.
            </span>
            <div>
              <ShieldCheck size={16} /> Your own private workspace
            </div>
          </div>
          <div>
            <span className="lp-kicker">WELCOME TO YOUR STUDIO</span>
            <h1>A thoughtful home for your practice.</h1>
            <p>
              Your appointments, your time, and a little more room to breathe.
              Sign in to pick up where you left off.
            </p>
            <div className="lp-auth-actions">
              <SignInButton mode="modal" forceRedirectUrl="/practice">
                <button className="lp-button">
                  Sign in to your practice <ArrowRight size={17} />
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/practice">
                <button className="lp-text-button">
                  New here? Create your account <ArrowRight size={15} />
                </button>
              </SignUpButton>
            </div>
            <p className="lp-caption">
              <LockKeyhole size={14} /> Secure sign-in. Access limited to your
              practice memberships.
            </p>
          </div>
        </section>
      ) : !isAuthenticated ? (
        <section className="lp-state" role="alert">
          <ShieldCheck />
          <h1>Let’s reconnect your practice.</h1>
          <p>
            You’re signed in, but we couldn’t verify your access to the
            workspace. Refresh to try again, or sign out using your account
            menu.
          </p>
          <button
            className="lp-button"
            onClick={() => window.location.reload()}
          >
            Refresh connection
          </button>
        </section>
      ) : (
        <PracticeBoundary>
          <PracticeHome />
        </PracticeBoundary>
      )}
    </Frame>
  );
}
class PracticeBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="lp-state" role="alert">
          <h1>Your practice needs a moment.</h1>
          <p>
            We couldn’t load this workspace. Your access may have changed, or
            the connection may have been interrupted. Refresh to check again.
          </p>
          <button
            className="lp-button"
            onClick={() => window.location.reload()}
          >
            Refresh workspace
          </button>
        </section>
      );
    return this.props.children;
  }
}
function PracticeHome() {
  const tenants = useQuery(practiceApi.tenants, {});
  const [selected, setSelected] = useState<TenantId | null>(null);
  const [creating, setCreating] = useState(false);
  if (!tenants)
    return (
      <div className="lp-loading" role="status">
        Finding your practice…
      </div>
    );
  const tenant = tenants.find((item) => item._id === selected) ?? tenants[0];
  if (!tenant || creating)
    return (
      <CreatePractice
        onCreated={(id) => {
          setSelected(id);
          setCreating(false);
        }}
        onCancel={tenant ? () => setCreating(false) : undefined}
      />
    );
  return (
    <>
      <div className="lp-workspace-heading">
        <div>
          <span className="lp-kicker">YOUR PRACTICE</span>
          <h1>A little shape to your day.</h1>
          <p>Welcome back. Here’s what’s coming up.</p>
        </div>
        <div className="lp-practice-picker">
          <label htmlFor="practice-selector">Current practice</label>
          <select
            id="practice-selector"
            value={tenant._id}
            onChange={(event) => setSelected(event.target.value as TenantId)}
          >
            {tenants.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
          <button className="lp-text-button" onClick={() => setCreating(true)}>
            <Plus size={14} /> Add a practice
          </button>
        </div>
      </div>
      <section className="lp-pilot">
        <ShieldCheck size={18} />
        <p>
          <strong>Private development workspace.</strong> Bookings here are
          saved to your account. Use sample names while we develop the service;
          reminders, payments and client invitations are not connected.
        </p>
      </section>
      <Bookings key={tenant._id} tenant={tenant} />
    </>
  );
}
function CreatePractice({
  onCreated,
  onCancel,
}: {
  onCreated: (id: TenantId) => void;
  onCancel?: () => void;
}) {
  const create = useMutation(practiceApi.createTenant);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || unconfirmed || !name.trim()) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      onCreated(await create({ name: name.trim() }));
    } catch (cause) {
      if (/INVALID_NAME|UNAUTHENTICATED|FORBIDDEN/.test(String(cause)))
        setError(readableError(cause));
      else {
        setUnconfirmed(true);
        setError(
          "We couldn’t confirm whether your practice was created. Refresh to check your practice list before trying again.",
        );
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <section className="lp-setup">
      <div className="lp-round-icon">
        <Flower2 size={28} />
      </div>
      <span className="lp-kicker">MAKE YOURSELF AT HOME</span>
      <h1>Let’s give your practice a place.</h1>
      <p>
        Start with its name. You’ll become the owner of this private workspace
        and can begin organising appointments.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="practice-name">Practice name</label>
        <input
          id="practice-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="The name you work under"
          required
          maxLength={100}
          autoComplete="organization"
        />
        {error && (
          <p className="lp-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="lp-button"
          disabled={pending || unconfirmed || !name.trim()}
        >
          {pending ? "Creating your practice…" : "Create my practice"}
          <ArrowRight size={17} />
        </button>
        {unconfirmed && (
          <button
            type="button"
            className="lp-text-button"
            onClick={() => window.location.reload()}
          >
            Refresh my practices
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            className="lp-text-button"
            disabled={pending}
            onClick={onCancel}
          >
            Back to my practice
          </button>
        )}
      </form>
    </section>
  );
}
function Bookings({ tenant }: { tenant: Tenant }) {
  const [day, setDay] = useState(() => localDate(new Date()));
  const [practitioner, setPractitioner] = useState("main");
  const [form, setForm] = useState(false);
  const [notice, setNotice] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const window = dayWindow(day);
  const result = useQuery(practiceApi.bookings, {
    tenantId: tenant._id,
    practitionerId: practitioner,
    ...window,
  });
  function shift(amount: number) {
    const next = new Date(`${day}T12:00:00`);
    next.setDate(next.getDate() + amount);
    setDay(localDate(next));
  }
  const dateLabel = new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="lp-calendar-grid">
      <section className="lp-agenda">
        <header>
          <div>
            <span className="lp-kicker">{tenant.name}</span>
            <h2>Your appointments</h2>
          </div>
          {tenant.role === "owner" ? (
            <button
              ref={addButton}
              className="lp-button"
              onClick={() => setForm(true)}
              disabled={form}
            >
              <Plus size={16} /> New booking
            </button>
          ) : (
            <span className="lp-viewer">View-only access</span>
          )}
        </header>
        <div className="lp-calendar-controls">
          <div className="lp-day-switch">
            <button
              disabled={form}
              aria-label="Previous day"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <label>
              <span className="lp-visually-hidden">Booking date</span>
              <input
                type="date"
                disabled={form}
                value={day}
                onChange={(event) => {
                  if (event.target.value) setDay(event.target.value);
                }}
              />
            </label>
            <button
              disabled={form}
              aria-label="Next day"
              onClick={() => shift(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <label className="lp-resource">
            Diary{" "}
            <select
              value={practitioner}
              disabled={form}
              onChange={(event) => setPractitioner(event.target.value)}
            >
              <option value="main">Main diary</option>
              <option value="online">Online sessions</option>
            </select>
          </label>
        </div>
        <div className="lp-day-label">
          <h3>{dateLabel}</h3>
          <span>
            {result
              ? `${result.items.length}${result.hasMore ? "+" : ""} appointments`
              : "Loading…"}
          </span>
        </div>
        {notice && (
          <p className="lp-success" role="status">
            <Check size={16} />
            {notice}
          </p>
        )}
        {!result ? (
          <p role="status" className="lp-empty">
            Loading your appointments…
          </p>
        ) : !result.items.length ? (
          <div className="lp-empty">
            <CalendarDays size={32} />
            <h3>A little breathing room.</h3>
            <p>No appointments start in this diary today.</p>
          </div>
        ) : (
          <ol className="lp-bookings">
            {result.items.map((booking) => (
              <li key={booking._id}>
                <time dateTime={new Date(booking.startsAt).toISOString()}>
                  {new Date(booking.startsAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <span className="lp-booking-dot" />
                <div>
                  <h3>{booking.clientLabel}</h3>
                  <p>
                    {Math.round((booking.endsAt - booking.startsAt) / 60000)}{" "}
                    minutes ·{" "}
                    {new Date(booking.endsAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    finish
                  </p>
                </div>
                <span className="lp-confirmed">Confirmed</span>
              </li>
            ))}
          </ol>
        )}
        {result?.hasMore && (
          <p role="status">
            Showing the first {result.limit} appointments. More appointments
            exist in this diary.
          </p>
        )}
        <p className="lp-caption">
          Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          This view shows appointments starting on the selected day.
        </p>
      </section>
      <aside className="lp-side-panel">
        {form ? (
          <BookingForm
            tenantId={tenant._id}
            practitionerId={practitioner}
            day={day}
            onDone={(date) => {
              setDay(date);
              setForm(false);
              setNotice("Appointment saved to your practice.");
              requestAnimationFrame(() => addButton.current?.focus());
            }}
            onCancel={() => {
              setForm(false);
              requestAnimationFrame(() => addButton.current?.focus());
            }}
          />
        ) : (
          <>
            <div className="lp-round-icon">
              <Flower2 size={25} />
            </div>
            <h2>
              Your time,
              <br />
              thoughtfully organised.
            </h2>
            <p>
              Keep a clear view of the day ahead. Your practice’s appointments
              are visible only to its members.
            </p>
            <div className="lp-side-note">
              <LockKeyhole size={17} />
              <span>
                {tenant.role === "owner"
                  ? "You own this workspace."
                  : "Your membership allows you to view appointments."}
              </span>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
function BookingForm({
  tenantId,
  practitionerId,
  day,
  onDone,
  onCancel,
}: {
  tenantId: TenantId;
  practitionerId: string;
  day: string;
  onDone: (date: string) => void;
  onCancel: () => void;
}) {
  const create = useMutation(practiceApi.createBooking);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ signature: string; key: string } | null>(null);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const values = new FormData(event.currentTarget);
    const date = String(values.get("day")),
      time = String(values.get("time"));
    const starts = new Date(`${date}T${time}`);
    if (
      !Number.isFinite(starts.getTime()) ||
      localDate(starts) !== date ||
      `${String(starts.getHours()).padStart(2, "0")}:${String(starts.getMinutes()).padStart(2, "0")}` !==
        time
    ) {
      setError(
        "That local time does not exist. Choose another appointment time.",
      );
      return;
    }
    const payload: Omit<BookingInput, "requestKey"> = {
      tenantId,
      practitionerId,
      clientLabel: String(values.get("client")).trim(),
      startsAt: starts.getTime(),
      endsAt: starts.getTime() + Number(values.get("duration")) * 60000,
    };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await create({ ...payload, requestKey: request.current.key });
      onDone(date);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <form className="lp-booking-form" onSubmit={submit}>
      <span className="lp-kicker">A PLACE IN YOUR DAY</span>
      <h2>New appointment</h2>
      <p>Use a first name or reference. Leave clinical information out.</p>
      <label>
        Client or reference
        <input
          autoFocus
          name="client"
          required
          maxLength={100}
          placeholder="e.g. Alex"
        />
      </label>
      <label>
        Date
        <input name="day" type="date" required defaultValue={day} />
      </label>
      <div className="lp-form-row">
        <label>
          Time
          <input name="time" type="time" required defaultValue="09:00" />
        </label>
        <label>
          Duration
          <select name="duration" defaultValue="60">
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="lp-error">
          {error}
        </p>
      )}
      <button className="lp-button" disabled={pending}>
        {pending ? "Saving appointment…" : "Save appointment"}
        <Check size={16} />
      </button>
      <button
        className="lp-text-button"
        type="button"
        disabled={pending}
        onClick={onCancel}
      >
        Cancel
      </button>
    </form>
  );
}
