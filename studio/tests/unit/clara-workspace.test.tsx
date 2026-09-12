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
const baselineRelease = {
  releaseId: "1".repeat(64),
  artifactDigest: `sha256:${"2".repeat(64)}`,
  version: "clara-2026-09-01",
  generation: 1,
};
const adaptedRelease = {
  releaseId: "3".repeat(64),
  artifactDigest: `sha256:${"4".repeat(64)}`,
  version: "clara-2026-09-01-rate-90",
  generation: 2,
};
const proposal = {
  proposalId: "5".repeat(64),
  expectedActiveReleaseId: baselineRelease.releaseId,
  candidateArtifactDigest: adaptedRelease.artifactDigest,
  candidateVersion: adaptedRelease.version,
  effectiveDate: "2026-09-01",
  previousRateMinor: 8000,
  newRateMinor: 9000,
  baselineTotalMinor: 12000,
  candidateTotalMinor: 13000,
  changedSessionIds: ["clara-session-2026-09-03"],
  explanation: "The eligible attended session changes from £80 to £90. The cancellation and prepaid session stay unchanged.",
  evaluation: {
    evaluationId: "eval-clara-rate-90",
    reportDigest: `sha256:${"6".repeat(64)}`,
    accepted: true,
    passed: 4,
    total: 4,
  },
};

function adaptation(operation: string, active = baselineRelease, extra = {}) {
  return { operation, adaptation: { schemaVersion: 1, active, ...extra } };
}

function reply(value: unknown) {
  return Promise.resolve(Response.json(value));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("prepares the fictional draft, shows its receipt and safely retries", async () => {
  const fetcher = vi.fn((_url, options) => {
    const { operation } = JSON.parse(options.body);
    return reply(
      operation === "adaptation-status" ? adaptation(operation) :
      operation === "prepare" ? run : operation === "run" ? { ...run, operation } :
      operation === "draft" ? draft : trace,
    );
  });
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
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(9));
  const prepareBodies = fetcher.mock.calls
    .map(([, options]) => JSON.parse(options.body))
    .filter((body) => body.operation === "prepare");
  expect(prepareBodies).toEqual([{ operation: "prepare" }, { operation: "prepare" }]);
});

it("reloads a saved authorized run without preparing another draft", async () => {
  localStorage.setItem("oceanheart:clara-fictional-run:v1", runId);
  const fetcher = vi.fn((_url, options) => {
    const { operation } = JSON.parse(options.body);
    return reply(
      operation === "adaptation-status" ? adaptation(operation) :
      operation === "run" ? { ...run, operation } : operation === "draft" ? draft : trace,
    );
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ClaraWorkspace ownerName="Synthetic owner" />);
  expect(await screen.findByRole("heading", { name: "Total £120.00" })).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(
    fetcher.mock.calls.map(([, options]) => JSON.parse(options.body).operation),
  ).toEqual(expect.arrayContaining(["adaptation-status", "run", "draft", "trace"]));
});

it("evaluates, explicitly activates and rolls back the bounded attended-rate change", async () => {
  const fetcher = vi.fn((_url, options) => {
    const body = JSON.parse(options.body);
    if (body.operation === "adaptation-status") return reply(adaptation(body.operation));
    if (body.operation === "adaptation-evaluate")
      return reply(adaptation(body.operation, baselineRelease, { proposal }));
    if (body.operation === "adaptation-activate")
      return reply(adaptation(body.operation, adaptedRelease, { rollbackTarget: baselineRelease }));
    if (body.operation === "adaptation-rollback")
      return reply(adaptation(body.operation, { ...baselineRelease, generation: 3 }));
    throw new Error(`Unexpected operation ${body.operation}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ClaraWorkspace ownerName="Synthetic owner" />);

  expect(await screen.findByText(/Active rule:/)).toHaveTextContent("clara-2026-09-01");
  expect(screen.getByText(/does not interpret general instructions/i)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Evaluate change" }));
  expect(await screen.findByRole("heading", { name: "£120.00 → £130.00" })).toBeVisible();
  expect(screen.getByText(/4\/4 checks passed/)).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Activate evaluated change" }));
  expect(await screen.findByRole("button", { name: /Roll back to clara-2026-09-01/ })).toBeVisible();
  expect(screen.getByText(/Active rule:/)).toHaveTextContent("clara-2026-09-01-rate-90");

  fireEvent.click(screen.getByRole("button", { name: /Roll back to clara-2026-09-01/ }));
  await waitFor(() => expect(screen.getByText(/Active rule:/)).toHaveTextContent("clara-2026-09-01"));
  const bodies = fetcher.mock.calls.map(([, options]) => JSON.parse(options.body));
  expect(bodies).toContainEqual({ operation: "adaptation-evaluate", effectiveDate: "2026-09-01", newRateMinor: 9000 });
  expect(bodies).toContainEqual({
    operation: "adaptation-activate",
    proposalId: proposal.proposalId,
    expectedActiveReleaseId: baselineRelease.releaseId,
  });
  expect(bodies).toContainEqual({
    operation: "adaptation-rollback",
    targetReleaseId: baselineRelease.releaseId,
    expectedActiveReleaseId: adaptedRelease.releaseId,
  });
});

it("rejects unsupported pilot values and never offers a stale proposal for activation", async () => {
  const fetcher = vi.fn((_url, options) => {
    const { operation } = JSON.parse(options.body);
    if (operation === "adaptation-status")
      return reply(adaptation(operation, baselineRelease, { proposal }));
    throw new Error(`Unexpected operation ${operation}`);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ClaraWorkspace ownerName="Synthetic owner" />);

  expect(await screen.findByRole("button", { name: "Activate evaluated change" })).toBeVisible();
  expect(screen.getByText("Pilot values: £90.00 effective 1 September 2026.")).toBeVisible();

  fireEvent.change(screen.getByLabelText("New standard rate (GBP)"), { target: { value: "95" } });
  expect(screen.queryByRole("button", { name: "Activate evaluated change" })).not.toBeInTheDocument();
  expect(screen.queryByText("Evaluated proposal")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Evaluate change" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This pilot supports only £90.00 effective 1 September 2026. The current rule remains active.",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText("New standard rate (GBP)"), { target: { value: "-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Evaluate change" }));
  expect(screen.getByRole("alert")).toHaveTextContent("This pilot supports only £90.00 effective 1 September 2026");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
