"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Task, TaskFilter, TaskList, TaskUpdateResult } from "./api";
import { hasErrorCode, readableError } from "./api";

export function PracticeShell({
  children,
  account,
}: {
  children: ReactNode;
  account?: ReactNode;
}) {
  return (
    <div className="lp-root">
      <a className="lp-skip" href="#practice-main">
        Skip to your practice
      </a>
      <header className="lp-header">
        <a href="/" className="lp-brand">
          oceanheart <span>Studio</span>
        </a>
        {account}
      </header>
      <main id="practice-main" className="lp-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
export function PracticeUnavailable() {
  return (
    <PracticeShell>
      <section className="lp-intro">
        <h1>Your practice is not available yet.</h1>
        <p>Account access is being configured. Please try again later.</p>
        <a href="/app" className="lp-button">
          Explore the sample practice
        </a>
      </section>
    </PracticeShell>
  );
}
export function CreatePractice({
  create,
  onCancel,
}: {
  create: (name: string, requestKey: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ value: string; key: string } | null>(null);
  const busy = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (busy.current || !value) return;
    if (request.current?.value !== value)
      request.current = { value, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await create(value, request.current.key);
      request.current = null;
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section className="lp-intro">
      <h1>Create a practice</h1>
      <p>Choose a name for your private workspace.</p>
      <form className="lp-form" onSubmit={submit}>
        <label htmlFor="practice-name">Practice name</label>
        <input
          id="practice-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoComplete="organization"
          required
          disabled={pending}
          placeholder="Practice name"
        />
        {error && <p role="alert">{error}</p>}
        <div className="lp-actions">
          <button className="lp-button" disabled={pending || !name.trim()}>
            {pending ? "Creating…" : "Create practice"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
export function TaskPanel({
  result,
  canWrite,
  filter,
  changeFilter,
  addTask,
  setCompleted,
  updateTask,
  removeTask,
}: {
  result: TaskList | undefined;
  canWrite: boolean;
  filter: TaskFilter;
  changeFilter: (filter: TaskFilter) => void;
  addTask: (title: string, requestKey: string) => Promise<unknown>;
  setCompleted: (task: Task, completed: boolean) => Promise<unknown>;
  updateTask: (task: Task, title: string, expectedRevision: number) => Promise<TaskUpdateResult>;
  removeTask: (task: Task, expectedRevision: number) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyTasks, setBusyTasks] = useState<Set<string>>(new Set());
  const request = useRef<{ value: string; key: string } | null>(null);
  const busy = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (busy.current || !value || !canWrite) return;
    if (request.current?.value !== value)
      request.current = { value, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await addTask(value, request.current.key);
      request.current = null;
      setTitle("");
      setNotice("Task saved.");
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section className="lp-tasks">
      <div className="lp-section-heading">
        <h2>Tasks</h2>
        {!canWrite && <span className="lp-muted">View-only access</span>}
      </div>
      <div className="lp-task-filters" aria-label="Task status">
        {(
          [
            ["all", "All"],
            ["open", "Open"],
            ["completed", "Completed"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            disabled={busyTasks.size > 0}
            onClick={() => changeFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {canWrite && (
        <form className="lp-task-form" onSubmit={submit}>
          <label htmlFor="task-title">New task</label>
          <div className="lp-inline">
            <input
              id="task-title"
              placeholder="What needs doing?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              disabled={pending}
            />
            <button className="lp-button" disabled={pending || !title.trim()}>
              {pending ? "Saving…" : "Add task"}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="lp-notice" role="status">
        {notice}
      </p>
      {!result ? (
        <p role="status">Loading tasks…</p>
      ) : result.items.length === 0 ? (
        <div className="lp-empty">
          <h3>
            {filter === "all"
              ? "No tasks yet"
              : filter === "open"
                ? "No open tasks"
                : "No completed tasks"}
          </h3>
          <p>
            {filter === "open"
              ? "Open tasks will appear here."
              : filter === "completed"
                ? "Completed tasks will appear here."
                : canWrite
              ? "Add a task to get started."
              : "Tasks added by your practice owner will appear here."}
          </p>
        </div>
      ) : (
        <ul className="lp-task-list">
          {result.items.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              canWrite={canWrite}
              setCompleted={setCompleted}
              updateTask={updateTask}
              removeTask={removeTask}
              setBusy={(id, busy) =>
                setBusyTasks((current) => {
                  const next = new Set(current);
                  if (busy) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
              reportOutcome={(message, isError = false) => {
                if (isError) setError(message);
                else setNotice(message);
              }}
            />
          ))}
        </ul>
      )}
      {result?.hasMore && (
        <p className="lp-muted">
          Showing the newest {result.limit} tasks. More tasks are saved in this
          practice.
        </p>
      )}
    </section>
  );
}
function TaskRow({
  task,
  canWrite,
  setCompleted,
  updateTask,
  removeTask,
  setBusy,
  reportOutcome,
}: {
  task: Task;
  canWrite: boolean;
  setCompleted: (task: Task, completed: boolean) => Promise<unknown>;
  updateTask: (task: Task, title: string, expectedRevision: number) => Promise<TaskUpdateResult>;
  removeTask: (task: Task, expectedRevision: number) => Promise<unknown>;
  setBusy: (id: string, busy: boolean) => void;
  reportOutcome: (message: string, isError?: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [restoreFocus, setRestoreFocus] = useState<"edit" | "remove" | null>(null);
  const [draft, setDraft] = useState(task.title);
  const [remoteChange, setRemoteChange] = useState(false);
  const saved = useRef({ title: task.title, revision: task.revision });
  const editBaseline = useRef({ title: task.title, revision: task.revision });
  const removeBaseline = useRef({ revision: task.revision });
  const editorRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  useEffect(() => {
    const previous = saved.current;
    if (previous.title === task.title && previous.revision === task.revision)
      return;
    if (draft === previous.title) {
      setDraft(task.title);
      setRemoteChange(false);
      editBaseline.current = { title: task.title, revision: task.revision };
    } else {
      setRemoteChange(true);
    }
    saved.current = { title: task.title, revision: task.revision };
  }, [draft, task.revision, task.title]);
  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (removing) confirmationRef.current?.focus();
  }, [removing]);
  useEffect(() => {
    if (editing || removing || !restoreFocus) return;
    (restoreFocus === "edit" ? editButtonRef : removeButtonRef).current?.focus();
    setRestoreFocus(null);
  }, [editing, removing, restoreFocus]);
  function startBusy() {
    busy.current = true;
    setPending(true);
    setBusy(String(task._id), true);
  }
  function finishBusy() {
    busy.current = false;
    setPending(false);
    setBusy(String(task._id), false);
  }
  async function change(completed: boolean) {
    if (busy.current || !canWrite) return;
    startBusy();
    setError("");
    try {
      await setCompleted(task, completed);
      reportOutcome(completed ? "Task completed." : "Task reopened.");
    } catch (cause) {
      if (hasErrorCode(cause, "TASK_REMOVED")) {
        const message = "This task was removed by another change. Reload the practice to review the latest list.";
        reportOutcome(message, true);
      } else setError(readableError(cause));
    } finally {
      finishBusy();
    }
  }
  async function saveTitle(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (busy.current || !value || !canWrite) return;
    const baseline = editBaseline.current;
    startBusy();
    setError("");
    try {
      const acknowledgement = await updateTask(task, value, baseline.revision);
      // The backend returns the actual revision, including no-op title saves.
      // This prevents its later query echo being mistaken for a remote edit.
      saved.current = { title: value, revision: acknowledgement.revision };
      editBaseline.current = { title: value, revision: acknowledgement.revision };
      setEditing(false);
      setRemoteChange(false);
      reportOutcome("Task title saved.");
    } catch (cause) {
      if (hasErrorCode(cause, "REVISION_CONFLICT")) {
        setRemoteChange(true);
        setError("This task changed elsewhere. Your draft is kept; use the latest title or save again after reviewing it.");
      } else if (hasErrorCode(cause, "TASK_REMOVED")) {
        setError("This task was removed by another change. Reload the practice to review the latest list.");
      } else setError(readableError(cause));
    } finally { finishBusy(); }
  }
  async function confirmRemoval() {
    if (busy.current || !canWrite) return;
    startBusy();
    setError("");
    try {
      await removeTask(task, removeBaseline.current.revision);
      setRemoving(false);
      reportOutcome("Task removed.");
    } catch (cause) {
      setError(readableError(cause));
    } finally { finishBusy(); }
  }
  return (
    <li data-task-id={task._id}>
      <div className="lp-task-row">
        <input
          type="checkbox"
          aria-label={task.title}
          checked={task.completed}
          disabled={pending || !canWrite}
          onChange={(e) => void change(e.target.checked)}
        />
        <span className={task.completed ? "lp-completed" : undefined}>
          {task.title}
        </span>
        <span className="lp-task-state">
          {pending ? "Saving…" : task.completed ? "Completed" : "Open"}
        </span>
        {canWrite && !editing && !removing && (
          <span className="lp-task-actions">
            <button
              ref={editButtonRef}
              type="button"
              aria-label={`Edit ${task.title}`}
              onClick={() => {
                editBaseline.current = { title: task.title, revision: task.revision };
                setDraft(task.title);
                setRemoteChange(false);
                setError("");
                setEditing(true);
              }}
              disabled={pending}
            >
              Edit
            </button>
            <button
              ref={removeButtonRef}
              type="button"
              aria-label={`Remove ${task.title}`}
              onClick={() => {
                removeBaseline.current = { revision: task.revision };
                setRemoving(true);
              }}
              disabled={pending}
            >
              Remove
            </button>
          </span>
        )}
      </div>
      {editing && (
        <form className="lp-task-editor" onSubmit={saveTitle}>
          <label>
            Task title
            <input
              ref={editorRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={200}
              disabled={pending}
            />
          </label>
          {remoteChange && (
            <p className="lp-task-conflict" role="status">
              This task changed elsewhere. Your draft is kept until you choose what to save.
            </p>
          )}
          <span className="lp-task-actions">
            <button disabled={pending || !draft.trim()}>Save title</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraft(task.title);
                setRemoteChange(false);
                editBaseline.current = { title: task.title, revision: task.revision };
                setError("");
              }}
            >
              Use latest title
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraft(task.title);
                setEditing(false);
                setRemoteChange(false);
                setError("");
                setRestoreFocus("edit");
              }}
            >
              Cancel
            </button>
          </span>
        </form>
      )}
      {removing && (
        <div ref={confirmationRef} className="lp-task-remove" role="group" aria-label={`Remove ${task.title}`} tabIndex={-1}>
          <p>Remove this task from your list?</p>
          <span className="lp-task-actions">
            <button type="button" onClick={() => void confirmRemoval()} disabled={pending}>
              Remove task
            </button>
            <button type="button" onClick={() => { setRemoving(false); setRestoreFocus("remove"); }} disabled={pending}>
              Keep task
            </button>
          </span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </li>
  );
}
