"use client";
import { Badge, Box, Button, Card, Field, Flex, Grid, Heading, Input, Text } from "@chakra-ui/react";
import { StudioSelect } from "@/components/studio-controls";
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
    <Box className="live-practice" bg="bg" color="fg">
      <a className="lp-skip" href="#practice-content">
        Skip to your practice
      </a>
      <Flex as="header" className="lp-header">
        <Link className="lp-brand" href="/">
          <Mark />
          <span>
            oceanheart <small>STUDIO</small>
          </span>
        </Link>
        <Box className="lp-header-end">
          <Link href="/app">
            Explore the prototype <ArrowRight size={14} />
          </Link>
          {account}
        </Box>
      </Flex>
      <main id="practice-content" tabIndex={-1}>
        {children}
      </main>
      <Flex as="footer" className="lp-footer">
        <span>Built with care. Looked after personally.</span>
        <Link href="/#contact">
          Your studio partner <ArrowRight size={14} />
        </Link>
      </Flex>
    </Box>
  );
}
export function PracticeUnavailable() {
  return (
    <Frame>
      <Grid as="section" className="lp-welcome" templateColumns={{base:"1fr",md:"1fr 1fr"}}>
        <Box className="lp-welcome-art">
          <Mark />
          <span>
            A little more space
            <br />
            for your practice.
          </span>
        </Box>
        <Box>
          <span className="lp-kicker">YOUR PRACTICE</span>
          <Heading as="h1">Your workspace is taking shape.</Heading>
          <Text>
            Private practice accounts are not available on this deployment yet.
            You can explore the full sample workspace while we prepare it.
          </Text>
          <Link className="lp-button" href="/app">
            Explore the sample practice <ArrowRight size={17} />
          </Link>
        </Box>
      </Grid>
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
        <Box className="lp-loading" role="status">
          <Mark />
          <Text>Opening your practice…</Text>
        </Box>
      ) : !isSignedIn ? (
        <Grid as="section" className="lp-welcome" templateColumns={{base:"1fr",md:"1fr 1fr"}}>
          <Box className="lp-welcome-art">
            <Mark />
            <span>
              A calmer day
              <br />
              starts here.
            </span>
            <Box>
              <ShieldCheck size={16} /> Your own private workspace
            </Box>
          </Box>
          <Box>
            <span className="lp-kicker">WELCOME TO YOUR STUDIO</span>
            <Heading as="h1">A thoughtful home for your practice.</Heading>
            <Text>
              Your appointments and tasks in one place.
              Sign in to pick up where you left off.
            </Text>
            <Box className="lp-auth-actions">
              <SignInButton mode="modal" forceRedirectUrl="/practice">
                <Button colorPalette="copper" className="lp-button">
                  Sign in to your practice <ArrowRight size={17} />
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/practice">
                <Button colorPalette="copper" variant="ghost" className="lp-text-button">
                  New here? Create your account <ArrowRight size={15} />
                </Button>
              </SignUpButton>
            </Box>
            <Text className="lp-caption">
              <LockKeyhole size={14} /> Secure sign-in. Access limited to your
              practice memberships.
            </Text>
          </Box>
        </Grid>
      ) : !isAuthenticated ? (
        <Card.Root as="section" bg="bg.panel" p={{base:6,md:10}} borderColor="border" rounded="2xl" className="lp-state" role="alert">
          <ShieldCheck />
          <Heading as="h1">Let’s reconnect your practice.</Heading>
          <Text>
            You’re signed in, but we couldn’t verify your access to the
            workspace. Refresh to try again, or sign out using your account
            menu.
          </Text>
          <Button colorPalette="copper"
            className="lp-button"
            onClick={() => window.location.reload()}
          >
            Refresh connection
          </Button>
        </Card.Root>
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
        <Card.Root as="section" bg="bg.panel" p={{base:6,md:10}} borderColor="border" rounded="2xl" className="lp-state" role="alert">
          <Heading as="h1">Your practice needs a moment.</Heading>
          <Text>
            We couldn’t load this workspace. Your access may have changed, or
            the connection may have been interrupted. Refresh to check again.
          </Text>
          <Button colorPalette="copper"
            className="lp-button"
            onClick={() => window.location.reload()}
          >
            Refresh workspace
          </Button>
        </Card.Root>
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
      <Box className="lp-loading" role="status">
        Finding your practice…
      </Box>
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
      <Box className="lp-workspace-heading">
        <Box>
          <span className="lp-kicker">YOUR PRACTICE</span>
          <Heading as="h1">A little shape to your day.</Heading>
          <Text>Welcome back. Here’s what’s coming up.</Text>
        </Box>
        <Box className="lp-practice-picker">
          <label htmlFor="practice-selector">Current practice</label>
          <StudioSelect
            id="practice-selector"
            value={tenant._id}
            onChange={(event) => setSelected(event.target.value as TenantId)}
          >
            {tenants.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </StudioSelect>
          <Button colorPalette="copper" variant="ghost" className="lp-text-button" onClick={() => setCreating(true)}>
            <Plus size={14} /> Add a practice
          </Button>
        </Box>
      </Box>
      <Card.Root as="section" className="lp-pilot" flexDirection="row" bg="bg.subtle">
        <ShieldCheck size={18} />
        <Text>
          <strong>Private development workspace.</strong> Bookings here are
          saved to your account. Use sample names while we develop the service;
          reminders, payments and client invitations are not connected.
        </Text>
      </Card.Root>
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
    <Card.Root as="section" className="lp-setup" bg="bg.panel" p={{base:6,md:10}} borderColor="border" rounded="2xl">
      <Box className="lp-round-icon">
        <Flower2 size={28} />
      </Box>
      <span className="lp-kicker">MAKE YOURSELF AT HOME</span>
      <Heading as="h1">Let’s give your practice a place.</Heading>
      <Text>
        Start with its name. You’ll become the owner of this private workspace
        and can begin organising appointments.
      </Text>
      <form onSubmit={submit}>
        <Field.Root required><Field.Label htmlFor="practice-name">Practice name</Field.Label>
        <Input
          id="practice-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="The name you work under"
          required
          maxLength={100}
          autoComplete="organization"
        /></Field.Root>
        {error && (
          <Text className="lp-error" role="alert">
            {error}
          </Text>
        )}
        <Button colorPalette="copper"
          type="submit"
          className="lp-button"
          disabled={pending || unconfirmed || !name.trim()}
        >
          {pending ? "Creating your practice…" : "Create my practice"}
          <ArrowRight size={17} />
        </Button>
        {unconfirmed && (
          <Button colorPalette="copper"
            type="button"
            variant="ghost" className="lp-text-button"
            onClick={() => window.location.reload()}
          >
            Refresh my practices
          </Button>
        )}
        {onCancel && (
          <Button colorPalette="copper"
            type="button"
            variant="ghost" className="lp-text-button"
            disabled={pending}
            onClick={onCancel}
          >
            Back to my practice
          </Button>
        )}
      </form>
    </Card.Root>
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
    <Grid className="lp-calendar-grid" templateColumns={{base:"1fr",xl:"minmax(0,1fr) 360px"}} gap={6} alignItems="start">
      <Card.Root as="section" className="lp-agenda" bg="bg.panel" borderColor="border" rounded="2xl">
        <header>
          <Box>
            <span className="lp-kicker">{tenant.name}</span>
            <Heading as="h2">Your appointments</Heading>
          </Box>
          {tenant.role === "owner" ? (
            <Button colorPalette="copper"
              ref={addButton}
              className="lp-button"
              onClick={() => setForm(true)}
              disabled={form}
            >
              <Plus size={16} /> New booking
            </Button>
          ) : (
            <Badge colorPalette="green" className="lp-viewer">View-only access</Badge>
          )}
        </header>
        <Box className="lp-calendar-controls">
          <Box className="lp-day-switch">
            <Button colorPalette="copper"
              variant="ghost"
              disabled={form}
              aria-label="Previous day"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={18} />
            </Button>
            <label>
              <span className="lp-visually-hidden">Booking date</span>
              <Input
                type="date"
                disabled={form}
                value={day}
                onChange={(event) => {
                  if (event.target.value) setDay(event.target.value);
                }}
              />
            </label>
            <Button colorPalette="copper"
              variant="ghost"
              disabled={form}
              aria-label="Next day"
              onClick={() => shift(1)}
            >
              <ChevronRight size={18} />
            </Button>
          </Box>
          <label className="lp-resource">
            Diary{" "}
            <StudioSelect
              value={practitioner}
              disabled={form}
              onChange={(event) => setPractitioner(event.target.value)}
            >
              <option value="main">Main diary</option>
              <option value="online">Online sessions</option>
            </StudioSelect>
          </label>
        </Box>
        <Box className="lp-day-label">
          <Heading as="h3">{dateLabel}</Heading>
          <span>
            {result
              ? `${result.items.length}${result.hasMore ? "+" : ""} appointments`
              : "Loading…"}
          </span>
        </Box>
        {notice && (
          <Text className="lp-success" role="status">
            <Check size={16} />
            {notice}
          </Text>
        )}
        {!result ? (
          <Text role="status" className="lp-empty">
            Loading your appointments…
          </Text>
        ) : !result.items.length ? (
          <Box className="lp-empty">
            <CalendarDays size={32} />
            <Heading as="h3">No appointments scheduled.</Heading>
            <Text>No appointments start in this diary today.</Text>
          </Box>
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
                <Box>
                  <Heading as="h3">{booking.clientLabel}</Heading>
                  <Text>
                    {Math.round((booking.endsAt - booking.startsAt) / 60000)}{" "}
                    minutes ·{" "}
                    {new Date(booking.endsAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    finish
                  </Text>
                </Box>
                <Badge colorPalette="green" className="lp-confirmed">Confirmed</Badge>
              </li>
            ))}
          </ol>
        )}
        {result?.hasMore && (
          <Text role="status">
            Showing the first {result.limit} appointments. More appointments
            exist in this diary.
          </Text>
        )}
        <Text className="lp-caption">
          Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          This view shows appointments starting on the selected day.
        </Text>
      </Card.Root>
      <Card.Root as="aside" className="lp-side-panel" borderColor="border" rounded="2xl">
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
            <Box className="lp-round-icon">
              <Flower2 size={25} />
            </Box>
            <Heading as="h2">
              Your practice diary
            </Heading>
            <Text>
              Keep a clear view of the day ahead. Your practice’s appointments
              are visible only to its members.
            </Text>
            <Box className="lp-side-note">
              <LockKeyhole size={17} />
              <span>
                {tenant.role === "owner"
                  ? "You own this workspace."
                  : "Your membership allows you to view appointments."}
              </span>
            </Box>
          </>
        )}
      </Card.Root>
    </Grid>
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
      <Heading as="h2">New appointment</Heading>
      <Text>Use a first name or reference. Leave clinical information out.</Text>
      <Field.Root><Field.Label>Client or reference</Field.Label><Input
          autoFocus
          name="client"
          required
          maxLength={100}
          placeholder="e.g. Alex"
        />
      </Field.Root>
      <Field.Root><Field.Label>Date</Field.Label><Input name="day" type="date" required defaultValue={day} />
      </Field.Root>
      <Box className="lp-form-row">
        <Field.Root><Field.Label>Time</Field.Label><Input name="time" type="time" required defaultValue="09:00" />
        </Field.Root>
        <Field.Root><Field.Label>Duration</Field.Label><StudioSelect name="duration" defaultValue="60">
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </StudioSelect>
        </Field.Root>
      </Box>
      {error && (
        <Text role="alert" className="lp-error">
          {error}
        </Text>
      )}
      <Button colorPalette="copper" type="submit" className="lp-button" disabled={pending}>
        {pending ? "Saving appointment…" : "Save appointment"}
        <Check size={16} />
      </Button>
      <Button colorPalette="copper"
        variant="ghost" className="lp-text-button"
        type="button"
        disabled={pending}
        onClick={onCancel}
      >
        Cancel
      </Button>
    </form>
  );
}
