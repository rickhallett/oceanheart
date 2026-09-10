"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import {
  practiceApi,
  type Booking,
  type Task,
  type TenantId,
  type TodayBookingList,
  type TodayTaskList,
} from "./api";
import { displayBookingTime } from "./booking-time";

type ReadyTasks = Extract<TodayTaskList, { status: "ready" }>;
type ReadyBookings = Extract<TodayBookingList, { status: "ready" }>;

function TodayTasks({ result }: { result: ReadyTasks }) {
  return (
    <section className="lp-today-group" aria-labelledby="today-tasks-heading">
      <h3 id="today-tasks-heading">Tasks due today</h3>
      {result.items.length === 0 ? (
        <p className="lp-muted">No tasks due today.</p>
      ) : (
        <ul className="lp-today-list">
          {result.items.map((task: Task) => (
            <li key={task._id} data-task-id={task._id}>
              <div>
                <p className="lp-today-title">{task.title}</p>
                {task.clientName && (
                  <p className="lp-muted">
                    {task.clientName}
                    {task.clientArchived ? " (archived)" : ""}
                  </p>
                )}
              </div>
              <span className="lp-task-state">
                {task.completed ? "Completed" : "Open"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.hasMore && (
        <p className="lp-muted">
          Showing the first {result.limit} tasks due today.
        </p>
      )}
    </section>
  );
}

function TodayBookings({ result }: { result?: ReadyBookings }) {
  return (
    <section className="lp-today-group" aria-labelledby="today-bookings-heading">
      <h3 id="today-bookings-heading">Bookings today</h3>
      {!result ? (
        <p role="status">Loading today’s bookings…</p>
      ) : result.items.length === 0 ? (
        <p className="lp-muted">No bookings today.</p>
      ) : (
        <ul className="lp-today-list">
          {result.items.map((booking: Booking) => (
            <li key={booking._id} data-booking-id={booking._id}>
              <div>
                <p className="lp-today-title">{booking.clientLabel}</p>
                <p className="lp-muted">
                  {displayBookingTime(booking.startsAt, result.timeZone)} –{" "}
                  {displayBookingTime(booking.endsAt, result.timeZone)}
                </p>
                {booking.serviceSnapshot && (
                  <p className="lp-muted">{booking.serviceSnapshot.name}</p>
                )}
              </div>
              <span className="lp-task-state">Scheduled</span>
            </li>
          ))}
        </ul>
      )}
      {result?.hasMore && (
        <p className="lp-muted">
          Showing the first {result.limit} bookings today.
        </p>
      )}
    </section>
  );
}

export function PracticeToday({
  tenantId,
  canWrite,
  openBookings,
}: {
  tenantId: TenantId;
  canWrite: boolean;
  openBookings: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const tasks = useQuery(practiceApi.todayTasks, { tenantId, refreshKey });
  const bookings = useQuery(
    practiceApi.todayBookings,
    canWrite && tasks?.status === "ready"
      ? { tenantId, refreshKey }
      : "skip",
  );

  useEffect(() => {
    if (tasks?.status !== "ready") return;
    // Server time and the stored practice zone determine the delay. This key
    // only asks Convex to re-run its authoritative query after local midnight.
    const timer = window.setTimeout(
      () => setRefreshKey((value) => value + 1),
      tasks.refreshAfterMs + 25,
    );
    return () => window.clearTimeout(timer);
  }, [tasks]);

  const setupState = tasks?.status === "setup_required";
  const invalidState = tasks?.status === "invalid_time_zone";
  const readyBookings =
    bookings?.status === "ready" &&
    tasks?.status === "ready" &&
    bookings.day === tasks.day &&
    bookings.timeZone === tasks.timeZone
      ? bookings
      : undefined;

  return (
    <section className="lp-today" aria-labelledby="today-heading">
      <h2 id="today-heading">Today</h2>
      {!tasks ? (
        <p role="status">Loading today’s tasks…</p>
      ) : setupState || invalidState ? (
        <div className="lp-empty">
          <p role="alert">
            {setupState
              ? "Set the practice time zone to use Today."
              : "The saved practice time zone is invalid."}
          </p>
          {canWrite ? (
            <button type="button" onClick={openBookings}>
              Open Bookings
            </button>
          ) : (
            <p className="lp-muted">Ask an owner to set the practice time zone.</p>
          )}
        </div>
      ) : tasks.status === "ready" ? (
        <>
          <p className="lp-muted lp-today-date" role="status">
            Practice date: {tasks.day} · {tasks.timeZone}
          </p>
          <TodayTasks result={tasks} />
          {canWrite && <TodayBookings result={readyBookings} />}
        </>
      ) : null}
    </section>
  );
}
