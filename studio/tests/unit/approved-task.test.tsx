import React from "react";
import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  PrepareTask,
  PrepareCompletion,
  ProposalReview,
} from "../../src/components/practice/approved-task";
import type { TenantId } from "../../src/components/practice/api";
import type { Id } from "../../backend/convex/_generated/dataModel";
vi.mock("convex/react", () => ({ useMutation: vi.fn(), useQuery: vi.fn() }));
import { useMutation, useQuery } from "convex/react";
const tenantId = "tenant" as TenantId,
  proposalId = "proposal" as Id<"actionProposals">;
beforeEach(() => {
  localStorage.clear();
  vi.mocked(useMutation).mockReset();
  vi.mocked(useQuery).mockReset();
});
it("prepares only exact editable task fields and evidence, without approving; failed retry uses one request key", async () => {
  const mutate = vi
    .fn()
    .mockRejectedValueOnce(Error("lost response"))
    .mockResolvedValueOnce(proposalId);
  vi.mocked(useMutation).mockReturnValue(mutate as never);
  render(
    <PrepareTask
      tenantId={tenantId}
      evidence={{ references: [], citations: [] }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Task title"), {
    target: { value: "Review synthetic policy" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare task proposal" }),
  );
  await screen.findByText(/Could not prepare/);
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare task proposal" }),
  );
  await screen.findByText(/Proposal prepared/);
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate.mock.calls[0][0]).toEqual(mutate.mock.calls[1][0]);
  expect(mutate.mock.calls[0][0].task).toEqual({
    title: "Review synthetic policy",
  });
  expect(
    screen.queryByRole("button", { name: "Approve and create task" }),
  ).toBeNull();
});
it("shows exact server payload and approval is an explicit click bound only to immutable proposal id", async () => {
  const decide = vi.fn().mockResolvedValue("task");
  vi.mocked(useMutation).mockReturnValue(decide as never);
  vi.mocked(useQuery).mockReturnValue({
    task: { title: "Exact server task", dueDate: "2041-01-12" },
    status: "pending",
    eligible: true,
    expiresAt: Date.now() + 60000,
    reason: "",
  });
  render(
    <ProposalReview
      tenantId={tenantId}
      proposalId={proposalId}
      clear={() => {}}
    />,
  );
  expect(decide).not.toHaveBeenCalled();
  expect(screen.getByText("Exact server task")).toBeVisible();
  expect(screen.getByText("Due: 2041-01-12")).toBeVisible();
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Approve and create task" }),
  );
  await waitFor(() =>
    expect(decide).toHaveBeenCalledWith({ tenantId, proposalId }),
  );
});
it("stale evidence disables approval and an executed receipt never offers a second create button", () => {
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.mocked(useQuery).mockReturnValue({
    task: { title: "Synthetic task" },
    status: "pending",
    eligible: false,
    expiresAt: Date.now() + 60000,
    reason: "Source changed",
  });
  const view = render(
    <ProposalReview
      tenantId={tenantId}
      proposalId={proposalId}
      clear={() => {}}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Approve and create task" }),
  ).toBeDisabled();
  vi.mocked(useQuery).mockReturnValue({
    task: { title: "Synthetic task" },
    status: "executed",
    eligible: false,
    expiresAt: Date.now() - 1,
    reason: "",
  });
  view.rerender(
    <ProposalReview
      tenantId={tenantId}
      proposalId={proposalId}
      clear={() => {}}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Approve and create task" }),
  ).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Task created");
});
it("completion review shows the exact target and effect and only approves explicitly", async () => {
  const decide = vi.fn().mockResolvedValue("existing-task");
  vi.mocked(useMutation).mockReturnValue(decide as never);
  vi.mocked(useQuery).mockReturnValue({
    action: "task.complete",
    target: { taskId: "existing-task", revision: 3 },
    task: { title: "Exact existing task" },
    status: "pending",
    eligible: true,
    expiresAt: Date.now() + 60000,
    reason: "",
  });
  render(
    <ProposalReview
      tenantId={tenantId}
      proposalId={proposalId}
      clear={() => {}}
    />,
  );
  expect(screen.getByText("Task ID: existing-task")).toBeVisible();
  expect(screen.getByText(/Mark this existing task complete/)).toBeVisible();
  expect(decide).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Approve and complete task" }),
  );
  await waitFor(() =>
    expect(decide).toHaveBeenCalledWith({ tenantId, proposalId }),
  );
});
it("completion preparation binds selected ID/revision and retries the same request without changing the task", async () => {
  const mutate = vi
    .fn()
    .mockRejectedValueOnce(Error("lost response"))
    .mockResolvedValue(proposalId);
  vi.mocked(useMutation).mockReturnValue(mutate as never);
  vi.mocked(useQuery).mockReturnValue({
    items: [{ _id: "existing-task", title: "Existing", revision: 3 }],
    hasMore: false,
  });
  render(<PrepareCompletion tenantId={tenantId} />);
  fireEvent.change(screen.getByLabelText("Open task"), {
    target: { value: "existing-task" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare completion proposal" }),
  );
  await screen.findByText(/Could not prepare completion/);
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare completion proposal" }),
  );
  await screen.findByText(/Proposal prepared/);
  expect(mutate.mock.calls[0][0]).toEqual(mutate.mock.calls[1][0]);
  expect(mutate.mock.calls[0][0]).toEqual({
    tenantId,
    taskId: "existing-task",
    expectedRevision: 3,
    requestKey: expect.any(String),
  });
});
it("stale completion is disabled and executed completion reports a durable receipt", () => {
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  const proposal = {
    action: "task.complete",
    target: { taskId: "existing-task", revision: 3 },
    task: { title: "Existing" },
    status: "pending",
    eligible: false,
    expiresAt: Date.now() + 60000,
    reason: "Task changed",
  };
  vi.mocked(useQuery).mockReturnValue(proposal);
  const view = render(
    <ProposalReview
      tenantId={tenantId}
      proposalId={proposalId}
      clear={() => {}}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Approve and complete task" }),
  ).toBeDisabled();
  vi.mocked(useQuery).mockReturnValue({ ...proposal, status: "executed" });
  view.rerender(
    <ProposalReview
      tenantId={tenantId}
      proposalId={proposalId}
      clear={() => {}}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Approve and complete task" }),
  ).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Task completion recorded",
  );
});
