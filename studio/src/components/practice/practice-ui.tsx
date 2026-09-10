"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Task, TaskClientOption, TaskFilter, TaskList, TaskUpdateResult } from "./api";
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
export function dueDateProblem(value: string): string {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return "Enter a real calendar date as YYYY-MM-DD.";
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1)
    return "Enter a real calendar date as YYYY-MM-DD.";
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > lengths[month - 1])
    return "Enter a real calendar date as YYYY-MM-DD.";
  return "";
}
export type ClientPickerState = {
  options: TaskClientOption[];
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  search: string;
};
// Compact tenant-scoped client picker shared by the create form and the row
// editor. The link control is always a select labeled exactly "Client" with
// a "None" (empty value) option for clearing; search narrows server-side.
// Archived records can never be newly linked, so the picker only lists
// active clients — except the currently-linked record, which stays
// selectable (and intelligible when archived) so title/date edits keep
// working after its client is archived.
export function ClientSelect({
  id,
  value,
  change,
  picker,
  changeSearch,
  loadMore,
  disabled,
  currentLink,
}: {
  id: string;
  value: string;
  change: (clientId: string) => void;
  picker: ClientPickerState;
  changeSearch: (search: string) => void;
  loadMore: () => void;
  disabled?: boolean;
  currentLink?: { id: string; name: string; archived: boolean };
}) {
  const loading = picker.status === "LoadingFirstPage";
  const visible = [...picker.options];
  if (
    currentLink &&
    !visible.some((option) => String(option._id) === currentLink.id)
  ) {
    visible.unshift({
      _id: currentLink.id as TaskClientOption["_id"],
      name: currentLink.name,
      archived: currentLink.archived,
    });
  }
  const empty =
    !loading && visible.length === 0 && (value === "" || picker.search !== "");
  return (
    <>
      <label htmlFor={`${id}-search`}>Search clients</label>
      <div className="lp-inline">
        <input
          id={`${id}-search`}
          value={picker.search}
          onChange={(event) => changeSearch(event.target.value)}
          placeholder="Search by name or email"
          maxLength={100}
          disabled={disabled}
        />
      </div>
      <label htmlFor={id}>Client</label>
      <div className="lp-inline">
        <select
          id={id}
          value={value}
          onChange={(event) => change(event.target.value)}
          disabled={disabled || loading}
        >
          <option value="">None</option>
          {visible.map((option) => (
            <option key={String(option._id)} value={String(option._id)}>
              {option.name}
              {option.archived ? " (archived)" : ""}
            </option>
          ))}
        </select>
      </div>
      {loading && <p role="status">Loading clients…</p>}
      {empty && (
        <p className="lp-muted" role="status">
          {picker.search
            ? "No matching clients."
            : "No clients yet. Add a client in Clients first."}
        </p>
      )}
      {picker.status === "CanLoadMore" && (
        <div className="lp-inline">
          <button type="button" onClick={loadMore} disabled={disabled}>
            More clients
          </button>
        </div>
      )}
    </>
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
  clientOptions,
  clientsStatus,
  clientSearch,
  changeClientSearch,
  loadMoreClients,
  openClient,
}: {
  result: TaskList | undefined;
  canWrite: boolean;
  filter: TaskFilter;
  changeFilter: (filter: TaskFilter) => void;
  addTask: (title: string, requestKey: string, dueDate?: string, clientId?: Task["clientId"]) => Promise<unknown>;
  setCompleted: (task: Task, completed: boolean) => Promise<unknown>;
  updateTask: (
    task: Task,
    title: string,
    expectedRevision: number,
    dueDate?: string | null,
    clientId?: Task["clientId"] | null,
  ) => Promise<TaskUpdateResult>;
  removeTask: (task: Task, expectedRevision: number) => Promise<unknown>;
  clientOptions?: TaskClientOption[];
  clientsStatus?: ClientPickerState["status"];
  clientSearch?: string;
  changeClientSearch?: (search: string) => void;
  loadMoreClients?: () => void;
  openClient?: (client: { name: string; archived: boolean }) => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState("");
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
    const dateProblem = dueDateProblem(dueDate);
    if (dateProblem) {
      setError(dateProblem);
      return;
    }
    const identity = `${value}||${dueDate}||${clientId}`;
    if (request.current?.value !== identity)
      request.current = { value: identity, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await addTask(
        value,
        request.current.key,
        dueDate ? dueDate : undefined,
        clientId ? (clientId as Task["clientId"]) : undefined,
      );
      request.current = null;
      setTitle("");
      setDueDate("");
      setClientId("");
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
          </div>
          <label htmlFor="task-due-date">Due date</label>
          <div className="lp-inline">
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={pending}
            />
          </div>
          <ClientSelect
            id="task-client"
            value={clientId}
            change={setClientId}
            picker={{
              options: clientOptions ?? [],
              status: clientsStatus ?? "Exhausted",
              search: clientSearch ?? "",
            }}
            changeSearch={changeClientSearch ?? (() => {})}
            loadMore={loadMoreClients ?? (() => {})}
            disabled={pending}
          />
          <div className="lp-inline">
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
              picker={{
                options: clientOptions ?? [],
                status: clientsStatus ?? "Exhausted",
                search: clientSearch ?? "",
              }}
              changeClientSearch={changeClientSearch ?? (() => {})}
              loadMoreClients={loadMoreClients ?? (() => {})}
              openClient={openClient}
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
  picker,
  changeClientSearch,
  loadMoreClients,
  openClient,
}: {
  task: Task;
  canWrite: boolean;
  setCompleted: (task: Task, completed: boolean) => Promise<unknown>;
  updateTask: (
    task: Task,
    title: string,
    expectedRevision: number,
    dueDate?: string | null,
    clientId?: Task["clientId"] | null,
  ) => Promise<TaskUpdateResult>;
  removeTask: (task: Task, expectedRevision: number) => Promise<unknown>;
  setBusy: (id: string, busy: boolean) => void;
  reportOutcome: (message: string, isError?: boolean) => void;
  picker: ClientPickerState;
  changeClientSearch: (search: string) => void;
  loadMoreClients: () => void;
  openClient?: (client: { name: string; archived: boolean }) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [restoreFocus, setRestoreFocus] = useState<"edit" | "remove" | null>(null);
  const [draft, setDraft] = useState(task.title);
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate ?? "");
  const [draftClientId, setDraftClientId] = useState(
    task.clientId !== undefined ? String(task.clientId) : "",
  );
  const [remoteChange, setRemoteChange] = useState(false);
  const saved = useRef({
    title: task.title,
    dueDate: task.dueDate ?? undefined,
    clientId: task.clientId !== undefined ? String(task.clientId) : undefined,
    revision: task.revision,
  });
  const editBaseline = useRef({
    title: task.title,
    dueDate: task.dueDate ?? undefined,
    clientId: task.clientId !== undefined ? String(task.clientId) : undefined,
    revision: task.revision,
  });
  const removeBaseline = useRef({ revision: task.revision });
  const editorRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  useEffect(() => {
    const previous = saved.current;
    const currentDueDate = task.dueDate ?? undefined;
    const currentClientId =
      task.clientId !== undefined ? String(task.clientId) : undefined;
    if (
      previous.title === task.title &&
      previous.dueDate === currentDueDate &&
      previous.clientId === currentClientId &&
      previous.revision === task.revision
    )
      return;
    if (
      draft === previous.title &&
      (draftDueDate || undefined) === previous.dueDate &&
      (draftClientId || undefined) === previous.clientId
    ) {
      setDraft(task.title);
      setDraftDueDate(currentDueDate ?? "");
      setDraftClientId(currentClientId ?? "");
      setRemoteChange(false);
      editBaseline.current = {
        title: task.title,
        dueDate: currentDueDate,
        clientId: currentClientId,
        revision: task.revision,
      };
    } else {
      setRemoteChange(true);
    }
    saved.current = {
      title: task.title,
      dueDate: currentDueDate,
      clientId: currentClientId,
      revision: task.revision,
    };
  }, [draft, draftDueDate, draftClientId, task.clientId, task.dueDate, task.revision, task.title]);
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
  async function saveTask(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (busy.current || !value || !canWrite) return;
    const dateProblem = dueDateProblem(draftDueDate);
    if (dateProblem) {
      setError(dateProblem);
      return;
    }
    const baseline = editBaseline.current;
    const nextDueDate = draftDueDate ? draftDueDate : null;
    const nextClientId = draftClientId
      ? (draftClientId as Task["clientId"])
      : null;
    startBusy();
    setError("");
    try {
      const acknowledgement = await updateTask(task, value, baseline.revision, nextDueDate, nextClientId);
      // The backend returns the actual revision, including no-op saves.
      // This prevents its later query echo being mistaken for a remote edit.
      const savedDueDate = nextDueDate ?? undefined;
      const savedClientId = nextClientId ?? undefined;
      saved.current = {
        title: value,
        dueDate: savedDueDate,
        clientId: savedClientId !== undefined ? String(savedClientId) : undefined,
        revision: acknowledgement.revision,
      };
      editBaseline.current = {
        title: value,
        dueDate: savedDueDate,
        clientId: savedClientId !== undefined ? String(savedClientId) : undefined,
        revision: acknowledgement.revision,
      };
      setEditing(false);
      setRemoteChange(false);
      reportOutcome("Task saved.");
    } catch (cause) {
      if (hasErrorCode(cause, "REVISION_CONFLICT")) {
        setRemoteChange(true);
        setError("This task changed elsewhere. Your draft is kept; use the latest or save again after reviewing it.");
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
        {task.dueDate !== undefined && (
          <span className="lp-muted">Due {task.dueDate}</span>
        )}
        {task.clientName !== undefined &&
          (openClient ? (
            <button
              className="lp-task-client"
              type="button"
              aria-label={`View ${task.clientName} in Clients`}
              onClick={() =>
                openClient({
                  name: task.clientName as string,
                  archived: task.clientArchived ?? false,
                })
              }
              disabled={pending}
            >
              {task.clientName}
              {task.clientArchived ? " (archived)" : ""}
            </button>
          ) : (
            <span className="lp-muted">
              {task.clientName}
              {task.clientArchived ? " (archived)" : ""}
            </span>
          ))}
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
                editBaseline.current = {
                  title: task.title,
                  dueDate: task.dueDate ?? undefined,
                  clientId:
                    task.clientId !== undefined ? String(task.clientId) : undefined,
                  revision: task.revision,
                };
                setDraft(task.title);
                setDraftDueDate(task.dueDate ?? "");
                setDraftClientId(
                  task.clientId !== undefined ? String(task.clientId) : "",
                );
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
        <form className="lp-task-editor" onSubmit={saveTask}>
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
          <label>
            Due date
            <input
              type="date"
              value={draftDueDate}
              onChange={(event) => setDraftDueDate(event.target.value)}
              disabled={pending}
            />
          </label>
          <ClientSelect
            id={`task-client-${String(task._id)}`}
            value={draftClientId}
            change={setDraftClientId}
            picker={picker}
            changeSearch={changeClientSearch}
            loadMore={loadMoreClients}
            disabled={pending}
            currentLink={
              task.clientId !== undefined && task.clientName !== undefined
                ? {
                    id: String(task.clientId),
                    name: task.clientName,
                    archived: task.clientArchived ?? false,
                  }
                : undefined
            }
          />
          {remoteChange && (
            <p className="lp-task-conflict" role="status">
              This task changed elsewhere. Your draft is kept until you choose what to save.
            </p>
          )}
          <span className="lp-task-actions">
            <button disabled={pending || !draft.trim()}>Save</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraft(task.title);
                setDraftDueDate(task.dueDate ?? "");
                setDraftClientId(
                  task.clientId !== undefined ? String(task.clientId) : "",
                );
                setRemoteChange(false);
                editBaseline.current = {
                  title: task.title,
                  dueDate: task.dueDate ?? undefined,
                  clientId:
                    task.clientId !== undefined ? String(task.clientId) : undefined,
                  revision: task.revision,
                };
                setError("");
              }}
            >
              Use latest
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraft(task.title);
                setDraftDueDate(task.dueDate ?? "");
                setDraftClientId(
                  task.clientId !== undefined ? String(task.clientId) : "",
                );
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
