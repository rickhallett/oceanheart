"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Task, TaskList } from "./api";
import { readableError } from "./api";

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
  addTask,
  setCompleted,
}: {
  result: TaskList | undefined;
  canWrite: boolean;
  addTask: (title: string, requestKey: string) => Promise<unknown>;
  setCompleted: (task: Task, completed: boolean) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
          <h3>No tasks yet</h3>
          <p>
            {canWrite
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
              save={setCompleted}
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
  save,
}: {
  task: Task;
  canWrite: boolean;
  save: (task: Task, completed: boolean) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function change(completed: boolean) {
    if (busy.current || !canWrite) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await save(task, completed);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <li data-task-id={task._id}>
      <label className="lp-task-row">
        <input
          type="checkbox"
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
      </label>
      {error && <p role="alert">{error}</p>}
    </li>
  );
}
