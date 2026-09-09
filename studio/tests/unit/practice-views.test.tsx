import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { PracticeViews } from "../../src/components/practice/practice-views";
import type { TenantId } from "../../src/components/practice/api";
vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useAction: vi.fn(() => vi.fn()),
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.mocked(useQuery).mockReturnValue({
    items: [],
    hasMore: false,
    limit: 200,
  });
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [],
    status: "CanLoadMore",
    isLoading: false,
    loadMore: vi.fn(),
  } as never);
});
it("resets paging and unsaved forms when practice changes, and never mounts client queries for viewers", async () => {
  const user = userEvent.setup();
  const first = "first" as TenantId,
    second = "second" as TenantId;
  const view = render(<PracticeViews tenantId={first} canWrite />);
  await user.click(screen.getByRole("button", { name: "Services" }));
  await user.click(screen.getByRole("button", { name: "Add service" }));
  await user.type(screen.getByLabelText("Service name"), "Unsaved");
  expect(vi.mocked(usePaginatedQuery).mock.calls.at(-1)?.slice(1)).toEqual([
    { tenantId: first, archived: false },
    { initialNumItems: 20 },
  ]);
  view.rerender(<PracticeViews tenantId={second} canWrite={false} />);
  expect(screen.getByRole("button", { name: "Tasks" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.queryByLabelText("Service name")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Clients" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Services" }));
  expect(vi.mocked(usePaginatedQuery).mock.calls.at(-1)?.slice(1)).toEqual([
    { tenantId: second, archived: false },
    { initialNumItems: 20 },
  ]);
  expect(
    vi
      .mocked(usePaginatedQuery)
      .mock.calls.some((call) => getFunctionName(call[0]) === "clients:list"),
  ).toBe(false);
});
it("removes owner-only client data immediately when the practice role changes", async () => {
  const user = userEvent.setup();
  const tenantId = "first" as TenantId;
  const view = render(<PracticeViews tenantId={tenantId} canWrite />);
  await user.click(screen.getByRole("button", { name: "Clients" }));
  expect(
    getFunctionName(vi.mocked(usePaginatedQuery).mock.calls.at(-1)![0]),
  ).toBe("clients:list");
  view.rerender(<PracticeViews tenantId={tenantId} canWrite={false} />);
  expect(
    screen.queryByRole("heading", { name: "Clients" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Tasks" })).toBeVisible();
});

it("role downgrade unmounts the private booking agenda and prevents further booking reads", async () => {
  const user = userEvent.setup();
  const tenantId = "first" as TenantId;
  const view = render(
    <PracticeViews tenantId={tenantId} canWrite timeZone="Europe/London" />,
  );
  await user.click(screen.getByRole("button", { name: "Bookings" }));
  expect(screen.getByLabelText("Booking date")).toBeVisible();
  vi.mocked(useQuery).mockClear();
  view.rerender(
    <PracticeViews
      tenantId={tenantId}
      canWrite={false}
      timeZone="Europe/London"
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Bookings" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Booking date")).not.toBeInTheDocument();
  expect(
    vi
      .mocked(useQuery)
      .mock.calls.some((call) => getFunctionName(call[0]) === "bookings:list"),
  ).toBe(false);
});

it("an unrepresentable agenda date skips the backend query and keeps the practice usable", async () => {
  const user = userEvent.setup();
  render(
    <PracticeViews
      tenantId={"first" as TenantId}
      canWrite
      timeZone="Pacific/Apia"
    />,
  );
  await user.click(screen.getByRole("button", { name: "Bookings" }));
  fireEvent.change(screen.getByLabelText("Booking date"), {
    target: { value: "2011-12-30" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("does not exist");
  expect(vi.mocked(useQuery).mock.calls.at(-1)?.[1]).toBe("skip");
  expect(screen.getByRole("button", { name: "New booking" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Booking date"), {
    target: { value: "2027-01-15" },
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New booking" })).toBeEnabled();
});

it("enquiry data and navigation are removed on role downgrade", async () => {
  const user = userEvent.setup();
  const tenantId = "first" as TenantId;
  const view = render(<PracticeViews tenantId={tenantId} canWrite />);
  await user.click(screen.getByRole("button", { name: "Enquiries" }));
  expect(screen.getByRole("heading", { name: "Enquiries" })).toBeVisible();
  vi.mocked(usePaginatedQuery).mockClear();
  view.rerender(<PracticeViews tenantId={tenantId} canWrite={false} />);
  expect(
    screen.queryByRole("button", { name: "Enquiries" }),
  ).not.toBeInTheDocument();
  expect(
    vi
      .mocked(usePaginatedQuery)
      .mock.calls.some((call) => getFunctionName(call[0]) === "enquiries:list"),
  ).toBe(false);
});

it("Gmail navigation and connection data unmount on permission downgrade", async () => {
  const user = userEvent.setup();
  const tenantId = "first" as TenantId;
  vi.mocked(useQuery).mockImplementation((...args) =>
    getFunctionName(args[0]) === "gmailConnections:status"
      ? { connected: false, generation: 0 }
      : { items: [], hasMore: false, limit: 200 },
  );
  const view = render(<PracticeViews tenantId={tenantId} canWrite />);
  await user.click(screen.getByRole("button", { name: "Gmail" }));
  expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  vi.mocked(useQuery).mockClear();
  view.rerender(<PracticeViews tenantId={tenantId} canWrite={false} />);
  expect(
    screen.queryByRole("button", { name: "Gmail" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Connect Gmail" }),
  ).not.toBeInTheDocument();
  expect(
    vi
      .mocked(useQuery)
      .mock.calls.some(
        (call) => getFunctionName(call[0]) === "gmailConnections:status",
      ),
  ).toBe(false);
});
