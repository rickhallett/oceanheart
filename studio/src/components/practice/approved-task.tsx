"use client";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../backend/convex/_generated/api";
import type { Id } from "../../../backend/convex/_generated/dataModel";
import type { AnswerResult } from "../../../backend/convex/citedAnswers";
import type { TenantId } from "./api";
const key = (tenantId: TenantId) => `studio:task-proposal:${tenantId}`;
function remember(tenantId: TenantId, id: string) {
  localStorage.setItem(key(tenantId), id);
  window.dispatchEvent(new Event("studio-task-proposal"));
}
export function PrepareTask({
  tenantId,
  evidence,
}: {
  tenantId: TenantId;
  evidence: Pick<AnswerResult, "references" | "citations">;
}) {
  const prepare = useMutation(api.approvedActions.prepare),
    busyRef = useRef(false),
    receipt = useRef<{ payload: string; key: string } | null>(null);
  const [title, setTitle] = useState(""),
    [dueDate, setDueDate] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    const args = {
      tenantId,
      task: { title, ...(dueDate ? { dueDate } : {}) },
      ...evidence,
    };
    const payload = JSON.stringify(args);
    if (receipt.current?.payload !== payload)
      receipt.current = { payload, key: crypto.randomUUID() };
    try {
      const id = await prepare({ ...args, requestKey: receipt.current.key });
      remember(tenantId, id);
      setMessage(
        "Proposal prepared. Review it in the task approval section before creating the task.",
      );
    } catch {
      setMessage(
        "Could not prepare the proposal. Check current source approval and task details, then retry.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="approved-task">
      <h3>Prepare a task from this evidence</h3>
      <p>
        You choose the task wording. Preparing a proposal creates no task.
        Approved task text is visible to practice members; source citations
        remain owner-only.
      </p>
      <label>
        Task title
        <input
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      </label>
      <label>
        Due date (optional)
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={busy}
        />
      </label>
      <button disabled={busy || !title.trim()} onClick={() => void submit()}>
        Prepare task proposal
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function PrepareCompletion({ tenantId }: { tenantId: TenantId }) {
  const tasks = useQuery(api.tasks.list, { tenantId, filter: "open" });
  const prepare = useMutation(api.approvedActions.prepareCompletion);
  const [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    receipt = useRef<{ payload: string; key: string } | null>(null);
  const task = tasks?.items.find((t) => t._id === selected);
  async function submit() {
    if (!task || lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const args = {
      tenantId,
      taskId: task._id,
      expectedRevision: task.revision,
    };
    const payload = JSON.stringify(args);
    if (receipt.current?.payload !== payload)
      receipt.current = { payload, key: crypto.randomUUID() };
    try {
      const id = await prepare({ ...args, requestKey: receipt.current.key });
      remember(tenantId, id);
      setMessage(
        "Proposal prepared. Review the exact task before marking it complete.",
      );
    } catch {
      setMessage(
        "Could not prepare completion. Check the current task and retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="approved-task">
      <h3>Complete an existing task with approval</h3>
      <p>
        Select an open task. Preparing a proposal leaves it open until you
        approve the exact change.
      </p>
      <label>
        Open task
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a task</option>
          {tasks?.items.map((t) => (
            <option key={t._id} value={t._id}>
              {t.title} · {t._id}
            </option>
          ))}
        </select>
      </label>
      {tasks && !tasks.items.length && <p>No open tasks are available.</p>}
      {tasks?.hasMore && <p>Showing the latest 200 open tasks.</p>}
      <button disabled={busy || !task} onClick={() => void submit()}>
        Prepare completion proposal
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
class ProposalBoundary extends Component<
  { children: ReactNode; clear: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>This proposal is unavailable with your current owner access.</p>
        <button onClick={this.props.clear}>Dismiss proposal</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function TaskApproval({ tenantId }: { tenantId: TenantId }) {
  const [id, setId] = useState<Id<"actionProposals"> | null>(null);
  useEffect(() => {
    const load = () =>
      setId(
        localStorage.getItem(key(tenantId)) as Id<"actionProposals"> | null,
      );
    load();
    window.addEventListener("storage", load);
    window.addEventListener("studio-task-proposal", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("studio-task-proposal", load);
    };
  }, [tenantId]);
  const clear = () => {
    localStorage.removeItem(key(tenantId));
    setId(null);
  };
  return id ? (
    <ProposalBoundary key={`${tenantId}:${id}`} clear={clear}>
      <ProposalReview tenantId={tenantId} proposalId={id} clear={clear} />
    </ProposalBoundary>
  ) : null;
}
export function ProposalReview({
  tenantId,
  proposalId,
  clear,
}: {
  tenantId: TenantId;
  proposalId: Id<"actionProposals">;
  clear: () => void;
}) {
  const proposal = useQuery(api.approvedActions.get, { tenantId, proposalId }),
    approve = useMutation(api.approvedActions.approve),
    reject = useMutation(api.approvedActions.reject);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    lock = useRef(false);
  useEffect(() => {
    if (!proposal) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, proposal.expiresAt - Date.now() + 10),
    );
    return () => clearTimeout(timer);
  }, [proposal]);
  async function decide(yes: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await (yes ? approve : reject)({ tenantId, proposalId });
    } catch {
      setError(
        "The decision could not complete. Retry to recover an existing receipt, or prepare a new proposal if access, evidence or expiry changed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!proposal) return <p role="status">Loading task proposal…</p>;
  const completing = proposal.action === "task.complete";
  return (
    <section className="approved-task" aria-label="Task approval">
      <h2>Review exact task</h2>
      <p>
        <strong>{proposal.task.title}</strong>
      </p>
      <p>Due: {proposal.task.dueDate || "No due date"}</p>
      {completing ? (
        <>
          <p>
            Mark this existing task complete. Its title, due date and client
            link stay the same.
          </p>
          <p>Task ID: {proposal.target?.taskId}</p>
        </>
      ) : (
        <p>
          Create one open task, with no client link, visible to practice
          members. No external action will occur.
        </p>
      )}
      {proposal.status === "pending" ? (
        <>
          <p>
            Expires {new Date(proposal.expiresAt).toLocaleTimeString()}. Changes
            to this wording need a new proposal.
          </p>
          {proposal.reason && <p role="alert">{proposal.reason}</p>}
          <div className="source-toolbar">
            <button
              disabled={busy || !proposal.eligible || now >= proposal.expiresAt}
              onClick={() => void decide(true)}
            >
              {completing
                ? "Approve and complete task"
                : "Approve and create task"}
            </button>
            <button disabled={busy} onClick={() => void decide(false)}>
              Reject proposal
            </button>
          </div>
        </>
      ) : (
        <p role="status">
          {proposal.status === "executed"
            ? completing
              ? "Task completion recorded. Repeated approval returns the same receipt without changing the task again."
              : "Task created. Repeated approval returns this same task."
            : completing
              ? "Proposal rejected. The task was not changed."
              : "Proposal rejected. No task was created."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button onClick={clear}>Dismiss proposal</button>
    </section>
  );
}
