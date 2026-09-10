"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, CalendarDays, ChevronRight } from "lucide-react";
import {
  practiceApi,
  readableError,
  type TenantId,
  type Task,
} from "../practice/api";
import { displayBookingTime } from "../practice/booking-time";
import { Panel, Pill } from "./context";
import { StudioButton } from "../studio-controls";
import type { View } from "./model";

export function LiveToday({
  tenantId,
  canWrite,
  ownerName,
  go,
}: {
  tenantId: TenantId;
  canWrite: boolean;
  ownerName: string;
  go: (view: View, extras?: Record<string, string>) => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const tasks = useQuery(practiceApi.todayTasks, { tenantId, refreshKey });
  const bookings = useQuery(
    practiceApi.todayBookings,
    canWrite && tasks?.status === "ready" ? { tenantId, refreshKey } : "skip",
  );
  const complete = useMutation(practiceApi.setCompleted);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (tasks?.status !== "ready") return;
    const timer = window.setTimeout(
      () => setRefreshKey((k) => k + 1),
      tasks.refreshAfterMs + 25,
    );
    const refresh = () => {
      if (document.visibilityState === "visible") setRefreshKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [tasks]);
  const readyBookings =
    bookings?.status === "ready" &&
    tasks?.status === "ready" &&
    bookings.day === tasks.day &&
    bookings.timeZone === tasks.timeZone
      ? bookings
      : undefined;
  async function toggle(task: Task) {
    if (busy) return;
    setBusy(task._id);
    setError("");
    try {
      await complete({
        tenantId,
        taskId: task._id,
        completed: !task.completed,
        expectedRevision: task.revision,
      });
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="ws-live-today">
      <div className="ws-welcome">
        <div>
          <p className="ws-date-label" role="status">
            {tasks?.status === "ready"
              ? `${tasks.day} · ${tasks.timeZone}`
              : "Your working day"}
          </p>
          <h1>Hello, {ownerName.split(" ")[0]}.</h1>
          {readyBookings && (
            <p>
              You have {readyBookings.hasMore ? "at least " : ""}
              {readyBookings.items.length}{" "}
              {readyBookings.items.length === 1 ? "session" : "sessions"} today.
            </p>
          )}
        </div>
        {canWrite && (
          <StudioButton onClick={() => go("calendar", { new: "booking" })}>
            <Plus size={17} /> New booking
          </StudioButton>
        )}
      </div>
      {!tasks ? (
        <p role="status">Loading your day…</p>
      ) : tasks.status !== "ready" ? (
        <div className="lp-empty">
          <p role="alert">
            {tasks.status === "setup_required"
              ? "Set the practice time zone to use Today."
              : "The saved practice time zone is invalid."}
          </p>
          {canWrite ? (
            <StudioButton onClick={() => go("calendar")}>
              Set practice time zone
            </StudioButton>
          ) : (
            <p>Ask an owner to set the practice time zone.</p>
          )}
        </div>
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          <div className="ws-dashboard-grid ws-today-work ws-live-today-grid">
            {canWrite && (
              <Panel
                title="Schedule"
                action={
                  <StudioButton
                    className="ws-link"
                    onClick={() => go("calendar")}
                  >
                    View calendar
                  </StudioButton>
                }
              >
                <div className="ws-agenda">
                  {!readyBookings ? (
                    <p role="status">Loading today’s bookings…</p>
                  ) : readyBookings.items.length === 0 ? (
                    <div className="lp-empty">
                      <CalendarDays size={24} />
                      <h3>No sessions scheduled</h3>
                      <p>Add a booking when you’re ready.</p>
                    </div>
                  ) : (
                    readyBookings.items.map((b) => (
                      <StudioButton
                        key={b._id}
                        className="ws-agenda-row"
                        data-booking-id={b._id}
                        onClick={() => go("calendar")}
                      >
                        <time>
                          {new Intl.DateTimeFormat("en-GB", {
                            timeZone: readyBookings.timeZone,
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(b.startsAt)}
                        </time>
                        <span className="ws-dot" />
                        <div>
                          <strong>{b.clientLabel}</strong>
                          <small>
                            {b.serviceSnapshot?.name ?? "Session"}
                            {b.serviceSnapshot
                              ? ` · ${b.serviceSnapshot.durationMinutes} min`
                              : ""}
                          </small>
                          <small>
                            {displayBookingTime(
                              b.startsAt,
                              readyBookings.timeZone,
                            )}
                          </small>
                        </div>
                        <Pill>Scheduled</Pill>
                        <ChevronRight size={17} />
                      </StudioButton>
                    ))
                  )}
                </div>
                {readyBookings?.hasMore && (
                  <p>Showing the first {readyBookings.limit} sessions.</p>
                )}
              </Panel>
            )}
            <Panel
              title="Tasks"
              action={
                <StudioButton className="ws-link" onClick={() => go("tasks")}>
                  All your tasks
                </StudioButton>
              }
            >
              <ul className="ws-live-tasks">
                {tasks.items.map((task) => (
                  <li key={task._id} data-task-id={task._id}>
                    <input
                      type="checkbox"
                      aria-label={task.title}
                      checked={task.completed}
                      disabled={!canWrite || busy !== null}
                      onChange={() => toggle(task)}
                    />
                    <div>
                      <span className={task.completed ? "ws-task-done" : ""}>
                        {task.title}
                      </span>
                      {task.clientName && (
                        <button
                          className="ws-link"
                          onClick={() =>
                            go("clients", {
                              search: task.clientName!,
                              archived: String(!!task.clientArchived),
                            })
                          }
                        >
                          {task.clientName}
                          {task.clientArchived ? " (archived)" : ""}
                        </button>
                      )}
                    </div>
                    <span className="lp-muted">
                      {task.completed ? "Completed" : "Open"}
                    </span>
                  </li>
                ))}
              </ul>
              {tasks.items.length === 0 && (
                <div className="lp-empty">
                  <h3>No tasks due today</h3>
                  <p>Your dated tasks will appear here.</p>
                </div>
              )}
              {tasks.hasMore && (
                <p>Showing the first {tasks.limit} tasks due today.</p>
              )}
            </Panel>
          </div>
          <div className="ws-stat-strip ws-live-stats">
            {canWrite && (
              <StudioButton onClick={() => go("calendar")}>
                <span>Appointments</span>
                <strong>
                  {readyBookings
                    ? `${readyBookings.items.length}${readyBookings.hasMore ? "+" : ""}`
                    : "…"}{" "}
                  <small>sessions today</small>
                </strong>
              </StudioButton>
            )}
            <StudioButton onClick={() => go("tasks")}>
              <span>Tasks due today</span>
              <strong>
                {tasks.items.length}
                {tasks.hasMore ? "+" : ""} <small>tasks</small>
              </strong>
            </StudioButton>
            <StudioButton onClick={() => go("tasks")}>
              <span>Completed</span>
              <strong>
                {tasks.items.filter((t) => t.completed).length}{" "}
                <small>
                  {tasks.hasMore ? "of shown tasks" : "tasks today"}
                </small>
              </strong>
            </StudioButton>
          </div>
        </>
      )}
    </section>
  );
}
