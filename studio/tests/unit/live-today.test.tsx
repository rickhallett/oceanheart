import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { useQuery, useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import { LiveToday } from "../../src/components/workspace/live-today";
import type { TenantId } from "../../src/components/practice/api";
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("../../src/components/workspace/context", () => ({
  Panel: ({ title, children, action }: any) => (
    <section>
      <h2>{title}</h2>
      {action}
      {children}
    </section>
  ),
  Pill: ({ children }: any) => <span>{children}</span>,
}));
vi.mock("../../src/components/studio-controls", () => ({
  StudioButton: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
const tenantId = "tenant-a" as TenantId;
const complete = vi.fn();
const task = {
  _id: "task-a",
  title: "Prepare notes",
  completed: false,
  revision: 4,
  createdAt: 1,
};
const result = {
  status: "ready",
  day: "2026-09-09",
  timeZone: "Etc/GMT+12",
  from: 1,
  to: 2,
  refreshAfterMs: 1000,
  items: [task],
  hasMore: false,
  limit: 200,
};
beforeEach(() => {
  vi.clearAllMocks();
  complete.mockResolvedValue(undefined);
  vi.mocked(useMutation).mockReturnValue(complete as never);
  vi.mocked(useQuery).mockImplementation((...args) =>
    args[1] === "skip"
      ? undefined
      : getFunctionName(args[0]) === "tasks:today"
        ? result
        : { ...result, items: [] },
  );
});
afterEach(() => vi.useRealTimers());
it("keeps Precision panels with server date and completes through revision-aware command", async () => {
  render(
    <LiveToday tenantId={tenantId} canWrite ownerName="Richard" go={vi.fn()} />,
  );
  expect(
    screen.getByRole("heading", { name: "Hello, Richard." }),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "2026-09-09 · Etc/GMT+12",
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Prepare notes" }));
  await waitFor(() =>
    expect(complete).toHaveBeenCalledWith({
      tenantId,
      taskId: "task-a",
      completed: true,
      expectedRevision: 4,
    }),
  );
});
it("viewer neither queries bookings nor renders derived private counts", () => {
  render(
    <LiveToday
      tenantId={tenantId}
      canWrite={false}
      ownerName="Viewer"
      go={vi.fn()}
    />,
  );
  expect(screen.queryByRole("heading", { name: "Schedule" })).toBeNull();
  expect(screen.queryByText("Appointments")).toBeNull();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(
    vi
      .mocked(useQuery)
      .mock.calls.filter((c) => getFunctionName(c[0]) === "bookings:today")
      .every((c) => c[1] === "skip"),
  ).toBe(true);
});
it("client links navigate to scoped active or archived client search", () => {
  vi.mocked(useQuery).mockImplementation((...args) =>
    getFunctionName(args[0]) === "tasks:today"
      ? {
          ...result,
          items: [{ ...task, clientName: "Morgan", clientArchived: true }],
        }
      : { ...result, items: [] },
  );
  const go = vi.fn();
  render(
    <LiveToday tenantId={tenantId} canWrite ownerName="Richard" go={go} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Morgan (archived)" }));
  expect(go).toHaveBeenCalledWith("clients", {
    search: "Morgan",
    archived: "true",
  });
});
it("refreshes on server midnight delay and cleans timers on unmount", () => {
  vi.useFakeTimers();
  const mounted = render(
    <LiveToday tenantId={tenantId} canWrite ownerName="Richard" go={vi.fn()} />,
  );
  act(() => vi.advanceTimersByTime(1025));
  expect(
    vi.mocked(useQuery).mock.calls.some((c) => (c[1] as any).refreshKey === 1),
  ).toBe(true);
  mounted.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
