import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ClientHistory, historyTime } from "../../src/components/practice/client-history";
import type { Client, TenantId } from "../../src/components/practice/api";
vi.mock("convex/react", () => ({ usePaginatedQuery: vi.fn(), useQuery: vi.fn() }));
const tenantId = "tenant-a" as TenantId;
const client = { _id: "client-a", name: "Alex", archived: false, revision: 0, createdAt: 1 } as Client;
const booking = { _id: "booking-a", startsAt: Date.UTC(2026, 9, 25, 1, 30), endsAt: Date.UTC(2026, 9, 25, 2, 30), timeZone: "Europe/London", status: "cancelled", revision: 2,
  serviceSnapshot: { name: "Consultation", durationMinutes: 60, priceMinor: 5000, currency: "GBP" } };
const loadMore = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePaginatedQuery).mockReturnValue({ results: [booking], status: "CanLoadMore", loadMore, isLoading: false } as never);
  vi.mocked(useQuery).mockReturnValue({ items: [{ action: "rescheduled", revision: 1, at: Date.UTC(2026, 8, 10), startsAt: booking.startsAt, endsAt: booking.endsAt, previousStartsAt: Date.UTC(2026, 9, 24, 12) }], hasMore: true, limit: 200 });
});
it("queries only on expansion, renders saved terms and pages without loading hidden activity", () => {
  render(<ClientHistory tenantId={tenantId} client={client} />);
  expect(usePaginatedQuery).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "View booking history" }));
  expect(vi.mocked(usePaginatedQuery).mock.calls[0][1]).toEqual({ tenantId, clientId: client._id });
  expect(screen.getByText("Cancelled")).toBeVisible();
  expect(screen.getByText("60 minutes · £50.00")).toBeVisible();
  expect(useQuery).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Load more bookings" }));
  expect(loadMore).toHaveBeenCalledWith(20);
  fireEvent.click(screen.getByRole("button", { name: "View activity" }));
  expect(vi.mocked(useQuery).mock.calls[0][1]).toEqual({ tenantId, bookingId: booking._id });
  expect(screen.getByText("Rescheduled")).toBeVisible();
  expect(screen.getByText(/From 24 Oct 2026/)).toHaveTextContent(/to 25 Oct 2026/);
  expect(screen.getByText("Showing the latest 200 activity entries.")).toBeVisible();
});
it("distinguishes loading, empty and loading-more states", () => {
  vi.mocked(usePaginatedQuery).mockReturnValue({ results: [], status: "LoadingFirstPage", loadMore } as never);
  const view = render(<ClientHistory tenantId={tenantId} client={client} />);
  fireEvent.click(screen.getByRole("button", { name: "View booking history" }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading booking history");
  expect(screen.queryByText(/No bookings linked/)).toBeNull();
  vi.mocked(usePaginatedQuery).mockReturnValue({ results: [], status: "Exhausted", loadMore } as never);
  view.rerender(<ClientHistory tenantId={tenantId} client={client} />);
  expect(screen.getByText(/No bookings linked/)).toBeVisible();
  vi.mocked(usePaginatedQuery).mockReturnValue({ results: [booking], status: "LoadingMore", loadMore } as never);
  view.rerender(<ClientHistory tenantId={tenantId} client={client} />);
  expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
});
it("isolates query failure and offers retry without losing the client record", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(usePaginatedQuery).mockImplementation(() => { throw new Error("FORBIDDEN"); });
  render(<ClientHistory tenantId={tenantId} client={client} />);
  fireEvent.click(screen.getByRole("button", { name: "View booking history" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Booking history could not be loaded");
  vi.mocked(usePaginatedQuery).mockReturnValue({ results: [], status: "Exhausted", loadMore } as never);
  fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
  expect(screen.getByText(/No bookings linked/)).toBeVisible();
  log.mockRestore();
});
it("disambiguates repeated London clock times and includes the year", () => {
  expect(historyTime(Date.UTC(2026, 9, 25, 0, 30), "Europe/London")).toContain("01:30 GMT+1");
  expect(historyTime(Date.UTC(2026, 9, 25, 1, 30), "Europe/London")).toContain("01:30 GMT");
  expect(historyTime(Date.UTC(2026, 9, 25, 1, 30), "Europe/London")).toContain("2026");
});
