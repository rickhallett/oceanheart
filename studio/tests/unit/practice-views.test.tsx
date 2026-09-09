import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { PracticeViews } from "../../src/components/practice/practice-views";
import type { TenantId } from "../../src/components/practice/api";
vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
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
    { tenantId: first },
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
    { tenantId: second },
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
