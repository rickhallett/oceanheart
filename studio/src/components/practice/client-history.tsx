"use client";

import { Component, useId, useState, type ReactNode } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { practiceApi, type Client, type ClientBooking, type TenantId } from "./api";
import { formatPrice } from "./money";

// History uses each booking's saved zone, never the browser's current zone.
export function historyTime(instant: number, zone?: string) {
  let timeZone = zone || "UTC";
  try { new Intl.DateTimeFormat("en-GB", { timeZone }).format(instant); }
  catch { timeZone = "UTC"; }
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone, timeZoneName: "shortOffset",
  }).format(instant);
}

class HistoryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert">
      <p>Booking history could not be loaded. Check your connection and practice access.</p>
      <button type="button" onClick={() => this.setState({ failed: false })}>Retry history</button>
    </div> : this.props.children;
  }
}

export function ClientHistory({ tenantId, client }: { tenantId: TenantId; client: Client }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="lp-client-history">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {open ? "Hide booking history" : "View booking history"}
    </button>
    {open && <section id={id} aria-label={`Booking history for ${client.name}`}>
      <h4>Booking history</h4>
      <HistoryBoundary key={`${tenantId}:${client._id}`}>
        <ClientHistoryList key={`${tenantId}:${client._id}`} tenantId={tenantId} clientId={client._id} />
      </HistoryBoundary>
    </section>}
  </div>;
}

function ClientHistoryList({ tenantId, clientId }: { tenantId: TenantId; clientId: Client["_id"] }) {
  const { results, status, loadMore } = usePaginatedQuery(practiceApi.clientBookings,
    { tenantId, clientId }, { initialNumItems: 20 });
  if (status === "LoadingFirstPage") return <p role="status">Loading booking history…</p>;
  return <>
    {!results.length ? <p>No bookings linked to this client yet.</p> : <>
      <p className="lp-muted">Latest appointment first. Times use the saved booking time zone.</p>
      <ul className="lp-client-bookings">
        {results.map(booking => <HistoryBooking key={booking._id} tenantId={tenantId} booking={booking} />)}
      </ul>
    </>}
    {status !== "Exhausted" && <button type="button" disabled={status !== "CanLoadMore"} onClick={() => loadMore(20)}>
      {status === "LoadingMore" ? "Loading…" : "Load more bookings"}
    </button>}
  </>;
}

function HistoryBooking({ tenantId, booking }: { tenantId: TenantId; booking: ClientBooking }) {
  const [activity, setActivity] = useState(false);
  const id = useId();
  return <li data-history-booking-id={booking._id}>
    <h5>{booking.serviceSnapshot?.name ?? "Booking"}</h5>
    <dl>
      <div><dt>Start</dt><dd>{historyTime(booking.startsAt, booking.timeZone)}</dd></div>
      <div><dt>End</dt><dd>{historyTime(booking.endsAt, booking.timeZone)}</dd></div>
      <div><dt>Status</dt><dd>{booking.status === "cancelled" ? "Cancelled" : "Scheduled"}</dd></div>
      {booking.serviceSnapshot && <div><dt>Booked terms</dt><dd>{booking.serviceSnapshot.durationMinutes} minutes · {formatPrice(booking.serviceSnapshot.priceMinor)}</dd></div>}
    </dl>
    <p className="lp-muted">{booking.timeZone ? `Booked in ${booking.timeZone}` : "No saved time zone; times shown in UTC."}</p>
    <button type="button" aria-expanded={activity} aria-controls={id} onClick={() => setActivity(!activity)}>
      {activity ? "Hide activity" : "View activity"}
    </button>
    {activity && <div id={id}><HistoryBoundary><BookingActivity tenantId={tenantId} booking={booking} /></HistoryBoundary></div>}
  </li>;
}

function BookingActivity({ tenantId, booking }: { tenantId: TenantId; booking: ClientBooking }) {
  const result = useQuery(practiceApi.bookingHistory, { tenantId, bookingId: booking._id });
  if (!result) return <p role="status">Loading activity…</p>;
  return <>
    {!result.items.length && <p>No recorded activity.</p>}
    <ol className="lp-booking-activity">
      {result.items.map(event => <li key={event.revision}>
        <strong>{({ created: "Created", rescheduled: "Rescheduled", cancelled: "Cancelled" })[event.action]}</strong>
        <p>{historyTime(event.at, booking.timeZone)}</p>
        {event.action === "rescheduled" && event.previousStartsAt !== undefined && <p>From {historyTime(event.previousStartsAt, booking.timeZone)} to {historyTime(event.startsAt, booking.timeZone)}</p>}
        {event.action === "created" && <p>Appointment: {historyTime(event.startsAt, booking.timeZone)}</p>}
      </li>)}
    </ol>
    {result.hasMore && <p>Showing the latest {result.limit} activity entries.</p>}
  </>;
}
