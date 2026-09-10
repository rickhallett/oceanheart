import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { PracticeToday } from "../../src/components/practice/today";
import type {
  Booking,
  Task,
  TenantId,
  TodayBookingList,
  TodayTaskList,
} from "../../src/components/practice/api";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

const tenantId = "practice-a" as TenantId;
const task = (overrides: Partial<Task> = {}): Task => ({
  _id: "task-a" as Task["_id"],
  title: "Call Morgan",
  completed: false,
  createdAt: 1,
  revision: 0,
  dueDate: "2027-03-28",
  ...overrides,
});
const booking: Booking = {
  _id: "booking-a" as Booking["_id"],
  startsAt: Date.parse("2027-03-28T09:00:00Z"),
  endsAt: Date.parse("2027-03-28T10:00:00Z"),
  clientLabel: "Morgan Lee",
  status: "scheduled",
  revision: 0,
  legacy: false,
};
const readyTasks: TodayTaskList = {
  status: "ready",
  day: "2027-03-28",
  timeZone: "Europe/London",
  from: Date.parse("2027-03-28T00:00:00Z"),
  to: Date.parse("2027-03-28T23:00:00Z"),
  refreshAfterMs: 1_000,
  items: [
    task({ clientName: "Morgan Lee", clientArchived: false }),
    task({
      _id: "task-b" as Task["_id"],
      title: "Send notes",
      completed: true,
    }),
  ],
  hasMore: false,
  limit: 200,
};
const readyBookings: TodayBookingList = {
  status: "ready",
  day: "2027-03-28",
  timeZone: "Europe/London",
  from: Date.parse("2027-03-28T00:00:00Z"),
  to: Date.parse("2027-03-28T23:00:00Z"),
  refreshAfterMs: 1_000,
  items: [booking],
  hasMore: false,
  limit: 200,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

it("renders authoritative owner tasks and bookings with stable selectors", () => {
  vi.mocked(useQuery).mockImplementation((...args) =>
    getFunctionName(args[0]) === "tasks:today"
      ? (readyTasks as never)
      : (readyBookings as never),
  );
  render(<PracticeToday tenantId={tenantId} canWrite openBookings={vi.fn()} />);

  expect(screen.getByRole("heading", { name: "Today" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Practice date: 2027-03-28 · Europe/London",
  );
  expect(screen.getByRole("heading", { name: "Tasks due today" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Bookings today" })).toBeVisible();
  expect(document.querySelector('[data-task-id="task-a"]')).toHaveTextContent(
    "Call MorganMorgan LeeOpen",
  );
  expect(document.querySelector('[data-task-id="task-b"]')).toHaveTextContent(
    "Send notesCompleted",
  );
  expect(document.querySelector('[data-booking-id="booking-a"]')).toHaveTextContent(
    "Morgan Lee",
  );
  expect(document.querySelector('[data-booking-id="booking-a"]')).toHaveTextContent(
    "Scheduled",
  );
  expect(vi.mocked(useQuery).mock.calls[0][1]).toEqual({
    tenantId,
    refreshKey: 0,
  });
  expect(vi.mocked(useQuery).mock.calls[1][1]).toEqual({
    tenantId,
    refreshKey: 0,
  });
});

it("never starts the owner-only booking query or exposes booking labels to viewers", () => {
  const viewerTasks: TodayTaskList = {
    ...readyTasks,
    items: [task()],
  };
  vi.mocked(useQuery).mockImplementation((...args) =>
    getFunctionName(args[0]) === "tasks:today"
      ? (viewerTasks as never)
      : (readyBookings as never),
  );
  render(
    <PracticeToday tenantId={tenantId} canWrite={false} openBookings={vi.fn()} />,
  );

  expect(screen.queryByRole("heading", { name: "Bookings today" })).toBeNull();
  expect(screen.queryByText("Morgan Lee")).toBeNull();
  expect(
    vi.mocked(useQuery).mock.calls.find(
      ([reference]) => getFunctionName(reference) === "bookings:today",
    )?.[1],
  ).toBe("skip");
});

it("fails closed with actionable unset and invalid-zone states", () => {
  const openBookings = vi.fn();
  vi.mocked(useQuery).mockReturnValue({ status: "setup_required" } as never);
  const view = render(
    <PracticeToday tenantId={tenantId} canWrite openBookings={openBookings} />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Set the practice time zone to use Today.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Open Bookings" }));
  expect(openBookings).toHaveBeenCalledOnce();

  vi.mocked(useQuery).mockReturnValue({ status: "invalid_time_zone" } as never);
  view.rerender(
    <PracticeToday tenantId={tenantId} canWrite={false} openBookings={vi.fn()} />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "The saved practice time zone is invalid.",
  );
  expect(
    screen.getByText("Ask an owner to set the practice time zone."),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open Bookings" })).toBeNull();
});

it("refreshes from the server-provided rollover delay and cleans the timer", async () => {
  vi.useFakeTimers();
  vi.mocked(useQuery).mockImplementation((...args) => {
    if (getFunctionName(args[0]) === "bookings:today") return undefined;
    const refreshKey = (args[1] as { refreshKey: number }).refreshKey;
    return {
      ...readyTasks,
      day: refreshKey === 0 ? "2027-03-28" : "2027-03-29",
      refreshAfterMs: 100,
      items: [],
    } as never;
  });
  const view = render(
    <PracticeToday tenantId={tenantId} canWrite={false} openBookings={vi.fn()} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("2027-03-28");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(126);
  });
  expect(screen.getByRole("status")).toHaveTextContent("2027-03-29");
  expect(
    vi.mocked(useQuery).mock.calls.filter(
      ([reference]) => getFunctionName(reference) === "tasks:today",
    ).at(-1)?.[1],
  ).toEqual({ tenantId, refreshKey: 1 });

  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
