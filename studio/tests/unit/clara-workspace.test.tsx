import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClaraWorkspace } from "../../src/components/clara/clara-workspace";

vi.mock("../../src/components/workspace/workspace", () => ({
  Shell: ({ live }: { live: { content: React.ReactNode } }) => <>{live.content}</>,
}));
vi.mock("../../src/app/practice/actions", () => ({ signOutPractice: vi.fn() }));

const runId = "123e4567-e89b-42d3-a456-426614174000";
const run = {
  operation: "prepare",
  run: {
    schemaVersion: 1,
    runId,
    status: "succeeded",
    inspectPath: `runs/${runId}`,
    draftId: `draft-${runId}`,
  },
};
const draft = {
  operation: "draft",
  draft: {
    schemaVersion: 1,
    currency: "GBP",
    draftId: `draft-${runId}`,
    lines: [
      { sessionId: "clara-session-2026-09-03", amountMinor: 8000, rateRef: "fictional-agreement-v1" },
      { sessionId: "clara-session-2026-09-10", amountMinor: 4000, policyRef: "fictional-cancellation-policy-v1" },
    ],
    totalMinor: 12000,
    unresolved: [],
    prepaidSessionIds: ["clara-session-2026-09-17"],
    excludedSessionIds: [],
    outstanding: [],
  },
};
const trace = {
  operation: "trace",
  trace: {
    schemaVersion: 1,
    eventCount: 5,
    configurationVersion: "clara-v1",
    inputHash: "a".repeat(64),
    resultHash: "b".repeat(64),
  },
};

function reply(value: unknown) {
  return Promise.resolve(Response.json(value));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("prepares the fictional draft, shows its receipt and safely retries", async () => {
  const fetcher = vi.fn()
    .mockImplementationOnce(() => reply(run))
    .mockImplementationOnce(() => reply({ ...run, operation: "run" }))
    .mockImplementationOnce(() => reply(draft))
    .mockImplementationOnce(() => reply(trace))
    .mockImplementationOnce(() => reply(run))
    .mockImplementationOnce(() => reply({ ...run, operation: "run" }))
    .mockImplementationOnce(() => reply(draft))
    .mockImplementationOnce(() => reply(trace));
  vi.stubGlobal("fetch", fetcher);
  render(<ClaraWorkspace ownerName="Synthetic owner" />);

  expect(screen.getByText("Fictional Clara demonstration")).toBeVisible();
  expect(screen.getByText(/does not send an invoice, collect payment or contact anyone/i)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Prepare invoice draft" }));
  expect(await screen.findByRole("heading", { name: "Total £120.00" })).toBeVisible();
  expect(screen.getByText(/1 prepaid session excluded/)).toBeVisible();
  expect(screen.getByText(/5 trace events · clara-v1/)).toBeVisible();
  expect(localStorage.getItem("oceanheart:clara-fictional-run:v1")).toBe(runId);

  fireEvent.click(screen.getByRole("button", { name: "Retry safely" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(8));
  const prepareBodies = fetcher.mock.calls
    .map(([, options]) => JSON.parse(options.body))
    .filter((body) => body.operation === "prepare");
  expect(prepareBodies).toEqual([{ operation: "prepare" }, { operation: "prepare" }]);
});

it("reloads a saved authorized run without preparing another draft", async () => {
  localStorage.setItem("oceanheart:clara-fictional-run:v1", runId);
  const fetcher = vi.fn()
    .mockImplementationOnce(() => reply({ ...run, operation: "run" }))
    .mockImplementationOnce(() => reply(draft))
    .mockImplementationOnce(() => reply(trace));
  vi.stubGlobal("fetch", fetcher);
  render(<ClaraWorkspace ownerName="Synthetic owner" />);
  expect(await screen.findByRole("heading", { name: "Total £120.00" })).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(
    fetcher.mock.calls.map(([, options]) => JSON.parse(options.body).operation),
  ).toEqual(["run", "draft", "trace"]);
});
