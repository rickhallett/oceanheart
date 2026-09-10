"use client";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import {
  practiceApi,
  readableError,
  hasErrorCode,
  type TenantId,
  type Booking,
  type Client,
  type Service,
} from "./api";
import {
  bookingTimeChoices,
  resolveBookingTime,
  bookingDay,
  todayIn,
  localBookingTime,
  displayBookingTime,
} from "./booking-time";
import { formatPrice } from "./money";
import type { PageStatus } from "./records-ui";
export function PracticeBookings({
  tenantId,
  timeZone,
}: {
  tenantId: TenantId;
  timeZone?: string;
}) {
  const setZone = useMutation(practiceApi.setTimeZone);
  const agendaTimeZone = validPracticeTimeZone(timeZone) ? timeZone : undefined;
  return (
    <section className="lp-bookings-workspace">
      <h2>Bookings</h2>
      <TimeZoneForm
        key={timeZone ?? "unset"}
        current={timeZone}
        save={(zone) =>
          setZone({
            tenantId,
            timeZone: zone,
            expectedTimeZone: timeZone ?? null,
          })
        }
      />
      {agendaTimeZone && (
        <BookingAgenda
          key={agendaTimeZone}
          tenantId={tenantId}
          timeZone={agendaTimeZone}
        />
      )}
    </section>
  );
}
export function validPracticeTimeZone(value?: string): value is string {
  if (!value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function TimeZoneForm({
  current,
  save,
}: {
  current?: string;
  save: (zone: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(current ?? "Europe/London"),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const busy = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || conflict) return;
    const zone = value.trim();
    if (!validPracticeTimeZone(zone)) {
      setError("Enter a valid IANA time zone, such as Europe/London.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await save(zone);
    } catch (cause) {
      setError(readableError(cause));
      setConflict(hasErrorCode(cause, "REVISION_CONFLICT"));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form className="lp-zone-form" onSubmit={submit}>
      <label htmlFor="practice-time-zone">Practice time zone</label>
      <div className="lp-inline">
        <input
          id="practice-time-zone"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          required
          maxLength={100}
        />
        <button type="submit" disabled={pending || conflict}>
          {pending ? "Saving…" : "Save time zone"}
        </button>
      </div>
      {!current && (
        <p className="lp-muted">
          Confirm the time zone before scheduling. Europe/London is a
          suggestion.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {conflict && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload practice
        </button>
      )}
    </form>
  );
}
function BookingAgenda({
  tenantId,
  timeZone,
}: {
  tenantId: TenantId;
  timeZone: string;
}) {
  const [day, setDay] = useState(() => todayIn(timeZone)),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Booking>(),
    [notice, setNotice] = useState("");
  let range: ReturnType<typeof bookingDay> | undefined;
  let dateError = "";
  try {
    range = bookingDay(day, timeZone);
  } catch (cause) {
    dateError = (cause as Error).message;
  }
  const result = useQuery(
    practiceApi.bookings,
    range ? { tenantId, ...range } : "skip",
  );
  const create = useMutation(practiceApi.createBooking),
    reschedule = useMutation(practiceApi.rescheduleBooking),
    cancel = useMutation(practiceApi.cancelBooking);
  return (
    <>
      <div className="lp-booking-toolbar">
        <div>
          <label htmlFor="agenda-date">Booking date</label>
          <input
            id="agenda-date"
            type="date"
            value={day}
            onChange={(event) => {
              if (event.target.value) {
                setDay(event.target.value);
                setAdding(false);
                setEditing(undefined);
              }
            }}
          />
          <p className="lp-muted">
            Times in {timeZone}. Showing bookings that overlap this date.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditing(undefined);
            setNotice("");
          }}
          disabled={!range || adding || !!editing}
        >
          New booking
        </button>
      </div>
      {dateError && <p role="alert">{dateError}</p>}
      {adding && (
        <CreateBookingForm
          tenantId={tenantId}
          day={day}
          timeZone={timeZone}
          create={create}
          done={() => {
            setAdding(false);
            setNotice("Booking saved.");
          }}
          cancel={() => setAdding(false)}
        />
      )}{" "}
      {editing && (
        <RescheduleForm
          key={editing._id}
          booking={editing}
          timeZone={timeZone}
          save={(startsAt) =>
            reschedule({
              tenantId,
              bookingId: editing._id,
              startsAt,
              expectedRevision: editing.revision,
            })
          }
          done={(startsAt) => {
            setDay(localBookingTime(startsAt, timeZone).slice(0, 10));
            setEditing(undefined);
            setNotice("Booking rescheduled.");
          }}
          cancel={() => setEditing(undefined)}
        />
      )}
      <p role="status" className="lp-notice">
        {notice}
      </p>
      {!result ? (
        <p role="status">Loading bookings…</p>
      ) : !result.items.length ? (
        <div className="lp-empty">
          <h3>No bookings on this date</h3>
        </div>
      ) : (
        <ul className="lp-record-list">
          {result.items.map((booking) => (
            <BookingRow
              key={booking._id}
              booking={booking}
              timeZone={timeZone}
              edit={() => {
                setEditing(booking);
                setAdding(false);
                setNotice("");
              }}
              cancel={() =>
                cancel({
                  tenantId,
                  bookingId: booking._id,
                  expectedRevision: booking.revision,
                })
              }
            />
          ))}
        </ul>
      )}
      {result?.hasMore && (
        <p className="lp-muted">
          Showing the first {result.limit} bookings overlapping this date.
        </p>
      )}
    </>
  );
}
export function BookingTimeInput({
  value,
  change,
  timeZone,
  fold,
  setFold,
}: {
  value: string;
  change: (value: string) => void;
  timeZone: string;
  fold: string;
  setFold: (fold: string) => void;
}) {
  let choices: ReturnType<typeof bookingTimeChoices> = [],
    error = "";
  if (value) {
    try {
      choices = bookingTimeChoices(value, timeZone);
    } catch (cause) {
      error = (cause as Error).message;
    }
  }
  return (
    <>
      <label htmlFor="booking-start">Start ({timeZone})</label>
      <input
        id="booking-start"
        type="datetime-local"
        value={value}
        step={60}
        required
        onChange={(event) => {
          change(event.target.value);
          setFold("");
        }}
      />
      {error && <p role="alert">{error}</p>}
      {choices.length === 2 && (
        <>
          <label htmlFor="booking-fold">
            This time occurs twice. Choose an occurrence
          </label>
          <select
            id="booking-fold"
            value={fold}
            required
            onChange={(event) => setFold(event.target.value)}
          >
            <option value="">Choose earlier or later</option>
            <option value="earlier">Earlier (UTC{choices[0].offset})</option>
            <option value="later">Later (UTC{choices[1].offset})</option>
          </select>
        </>
      )}
    </>
  );
}
type PickPage<T> = { items: T[]; status: PageStatus; loadMore: () => void };
function CreateBookingForm({
  tenantId,
  day,
  timeZone,
  create,
  done,
  cancel,
}: {
  tenantId: TenantId;
  day: string;
  timeZone: string;
  create: (args: {
    tenantId: TenantId;
    clientId: Client["_id"];
    serviceId: Service["_id"];
    startsAt: number;
    requestKey: string;
  }) => Promise<unknown>;
  done: () => void;
  cancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const clients = usePaginatedQuery(
    practiceApi.clients,
    { tenantId, archived: false, search },
    { initialNumItems: 20 },
  );
  const services = usePaginatedQuery(
    practiceApi.services,
    { tenantId, archived: false },
    { initialNumItems: 20 },
  );
  return (
    <BookingForm
      timeZone={timeZone}
      day={day}
      search={search}
      setSearch={setSearch}
      clients={{
        items: clients.results,
        status: clients.status,
        loadMore: () => clients.loadMore(20),
      }}
      services={{
        items: services.results,
        status: services.status,
        loadMore: () => services.loadMore(20),
      }}
      create={(input, key) => create({ ...input, tenantId, requestKey: key })}
      done={done}
      cancel={cancel}
    />
  );
}
export function BookingForm({
  timeZone,
  day,
  clients,
  services,
  search,
  setSearch,
  create,
  done,
  cancel,
}: {
  timeZone: string;
  day: string;
  clients: PickPage<Client>;
  services: PickPage<Service>;
  search: string;
  setSearch: (value: string) => void;
  create: (
    input: {
      clientId: Client["_id"];
      serviceId: Service["_id"];
      startsAt: number;
    },
    key: string,
  ) => Promise<unknown>;
  done: () => void;
  cancel: () => void;
}) {
  const [clientId, setClient] = useState(""),
    [serviceId, setService] = useState(""),
    [local, setLocal] = useState(`${day}T09:00`),
    [fold, setFold] = useState(""),
    [query, setQuery] = useState(search),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ signature: string; key: string } | undefined>(
      undefined,
    ),
    busy = useRef(false);
  const client = clients.items.find(
      (item) => item._id === clientId && !item.archived,
    ),
    service = services.items.find(
      (item) => item._id === serviceId && item.active,
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !client || !service) return;
    let startsAt: number;
    try {
      startsAt = resolveBookingTime(local, timeZone, fold);
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }
    const input = { clientId: client._id, serviceId: service._id, startsAt };
    const signature = JSON.stringify(input);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await create(input, request.current.key);
      done();
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form className="lp-record-form" onSubmit={submit}>
      <h3>New booking</h3>
      <fieldset disabled={pending}>
        <label htmlFor="booking-client-search">
          Find client by name or email
        </label>
        <div className="lp-inline">
          <input
            id="booking-client-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
          />
          <button
            type="button"
            onClick={() => {
              if (query.trim().split(/\s+/).filter(Boolean).length > 16) {
                setError("Use up to 16 search terms.");
                return;
              }
              setClient("");
              setSearch(query.trim());
            }}
          >
            Find
          </button>
        </div>
        <label htmlFor="booking-client">Client</label>
        <select
          id="booking-client"
          value={client ? clientId : ""}
          onChange={(event) => setClient(event.target.value)}
          required
        >
          <option value="">Choose an active client</option>
          {clients.items.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
              {item.email ? ` · ${item.email}` : ""}
            </option>
          ))}
        </select>
        <PickerMore page={clients} noun="clients" />
        <label htmlFor="booking-service">Service</label>
        <select
          id="booking-service"
          value={service ? serviceId : ""}
          onChange={(event) => setService(event.target.value)}
          required
        >
          <option value="">Choose an active service</option>
          {services.items.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name} · {item.durationMinutes} min ·{" "}
              {formatPrice(item.priceMinor)}
            </option>
          ))}
        </select>
        <PickerMore page={services} noun="services" />
        <BookingTimeInput
          value={local}
          change={setLocal}
          timeZone={timeZone}
          fold={fold}
          setFold={setFold}
        />
        <div className="lp-actions">
          <button
            type="submit"
            className="lp-button"
            disabled={!client || !service}
          >
            {pending ? "Saving…" : "Save booking"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function PickerMore({
  page,
  noun,
}: {
  page: PickPage<unknown>;
  noun: string;
}) {
  if (page.status === "LoadingFirstPage")
    return <p role="status">Loading {noun}…</p>;
  if (page.status === "Exhausted")
    return page.items.length ? null : (
      <p className="lp-muted">No active {noun} match.</p>
    );
  return (
    <button
      type="button"
      disabled={page.status !== "CanLoadMore"}
      onClick={page.loadMore}
    >
      {page.status === "LoadingMore" ? "Loading…" : `Load more ${noun}`}
    </button>
  );
}
export function RescheduleForm({
  booking,
  timeZone,
  save,
  done,
  cancel,
}: {
  booking: Booking;
  timeZone: string;
  save: (startsAt: number) => Promise<unknown>;
  done: (startsAt: number) => void;
  cancel: () => void;
}) {
  const [local, setLocal] = useState(
      localBookingTime(booking.startsAt, timeZone),
    ),
    [fold, setFold] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const busy = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || conflict) return;
    let startsAt: number;
    try {
      startsAt = resolveBookingTime(local, timeZone, fold);
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await save(startsAt);
      done(startsAt);
    } catch (cause) {
      setError(readableError(cause));
      setConflict(hasErrorCode(cause, "REVISION_CONFLICT"));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form className="lp-record-form" onSubmit={submit}>
      <h3>Reschedule {booking.clientLabel}</h3>
      <fieldset disabled={pending}>
        <BookingTimeInput
          value={local}
          change={setLocal}
          timeZone={timeZone}
          fold={fold}
          setFold={setFold}
        />
        <div className="lp-actions">
          <button type="submit" className="lp-button" disabled={conflict}>
            {pending ? "Saving…" : "Save new time"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {conflict && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload practice
        </button>
      )}
    </form>
  );
}
export function BookingRow({
  booking,
  timeZone,
  edit,
  cancel,
}: {
  booking: Booking;
  timeZone: string;
  edit: () => void;
  cancel: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const busy = useRef(false);
  async function cancelBooking() {
    if (busy.current || conflict) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await cancel();
    } catch (cause) {
      setError(readableError(cause));
      setConflict(hasErrorCode(cause, "REVISION_CONFLICT"));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <li data-booking-id={booking._id}>
      <h3>{booking.clientLabel}</h3>
      <p>
        {displayBookingTime(booking.startsAt, timeZone)} –{" "}
        {displayBookingTime(booking.endsAt, timeZone)}
      </p>
      <p>
        {booking.serviceSnapshot
          ? `${booking.serviceSnapshot.name} · ${booking.serviceSnapshot.durationMinutes} minutes · ${formatPrice(booking.serviceSnapshot.priceMinor)}`
          : "Legacy booking"}
      </p>
      <p className="lp-muted">
        {booking.status === "cancelled" ? "Cancelled" : "Scheduled"}
        {booking.timeZone && booking.timeZone !== timeZone
          ? ` · Originally booked in ${booking.timeZone}`
          : ""}
      </p>
      {booking.status === "scheduled" && (
        <div className="lp-actions">
          {!booking.legacy && (
            <button type="button" disabled={pending || conflict} onClick={edit}>
              Reschedule
            </button>
          )}
          <button
            type="button"
            disabled={pending || conflict}
            onClick={() => void cancelBooking()}
          >
            {pending ? "Cancelling…" : "Cancel booking"}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {conflict && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload practice
        </button>
      )}
    </li>
  );
}
