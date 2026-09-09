import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CreatePractice,
  TaskPanel,
  dueDateProblem,
} from "../../src/components/practice/practice-ui";
import { practiceConfigured } from "../../src/lib/practice-config";
import type { Task } from "../../src/components/practice/api";

const taskPanelCallbacks = () => ({
  filter: "all" as const,
  changeFilter: vi.fn(),
  updateTask: vi.fn().mockResolvedValue({ taskId: "task", revision: 1 }),
  removeTask: vi.fn().mockResolvedValue("task"),
  clientOptions: [
    { _id: "client-a", name: "Ava Stone", archived: false },
    { _id: "client-b", name: "Ben Cross", archived: false },
  ] as unknown as { _id: Task["clientId"]; name: string; archived: boolean }[],
  clientsStatus: "Exhausted" as const,
  clientSearch: "",
  changeClientSearch: vi.fn(),
  loadMoreClients: vi.fn(),
});

describe("configuration", () => {
  const env = {
    WORKOS_CLIENT_ID: "client_test",
    WORKOS_API_KEY: "test",
    WORKOS_COOKIE_PASSWORD: "x".repeat(32),
    NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
    NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://staging.example.com/callback",
  };
  it("rejects padded configuration and malformed WorkOS client IDs", () => {
    for (const [key, value] of Object.entries(env)) {
      expect(practiceConfigured({ ...env, [key]: ` ${value}` })).toBe(false);
      expect(practiceConfigured({ ...env, [key]: `${value} ` })).toBe(false);
    }
    for (const value of ["client_", "invalid", "client_a/b", "client_a b"]) {
      expect(practiceConfigured({ ...env, WORKOS_CLIENT_ID: value })).toBe(
        false,
      );
    }
  });
  it("fails closed for partial or unsafe callback configuration", () => {
    expect(practiceConfigured(env)).toBe(true);
    expect(
      practiceConfigured({
        ...env,
        NEXT_PUBLIC_WORKOS_REDIRECT_URI:
          "https://user:password@staging.example.com/callback",
      }),
    ).toBe(false);
    expect(
      practiceConfigured({
        ...env,
        NEXT_PUBLIC_CONVEX_URL: "https://user:password@example.convex.cloud",
      }),
    ).toBe(false);
    expect(
      practiceConfigured({ ...env, WORKOS_COOKIE_PASSWORD: "short" }),
    ).toBe(false);
    expect(practiceConfigured({ ...env, WORKOS_API_KEY: "" })).toBe(false);
    expect(
      practiceConfigured({
        ...env,
        NEXT_PUBLIC_WORKOS_REDIRECT_URI: "http://other.example.com/callback",
      }),
    ).toBe(false);
    expect(
      practiceConfigured({
        ...env,
        NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://staging.example.com/wrong",
      }),
    ).toBe(false);
  });
});
it("practice creation retains its request key when acknowledgement fails", async () => {
  const user = userEvent.setup();
  const create = vi
    .fn()
    .mockRejectedValueOnce(new Error("network detail"))
    .mockResolvedValue(undefined);
  render(<CreatePractice create={create} />);
  await user.type(screen.getByLabelText("Practice name"), " First practice ");
  await user.click(screen.getByRole("button", { name: "Create practice" }));
  expect(screen.getByRole("alert")).not.toHaveTextContent("network detail");
  await user.click(screen.getByRole("button", { name: "Create practice" }));
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  expect(create.mock.calls[0][0]).toBe("First practice");
});
it("task creation preserves input on error and safely retries before clearing on success", async () => {
  const user = userEvent.setup();
  const addTask = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost response"))
    .mockResolvedValue("task");
  render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={addTask}
      setCompleted={vi.fn()}
    />,
  );
  expect(screen.getByText("No tasks yet")).toBeVisible();
  await user.type(screen.getByLabelText("New task"), "Review schedule");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(screen.getByLabelText("New task")).toHaveValue("Review schedule");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask.mock.calls[0]).toEqual(addTask.mock.calls[1]);
  expect(screen.getByLabelText("New task")).toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent("Task saved.");
});
it("task state follows saved query data and viewers cannot write", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Review schedule",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  const save = vi.fn().mockResolvedValue("task");
  const props = {
    result: { items: [task], hasMore: false, limit: 200 },
    canWrite: true,
    ...taskPanelCallbacks(),
    addTask: vi.fn(),
    setCompleted: save,
  };
  const view = render(<TaskPanel {...props} />);
  await user.click(screen.getByRole("checkbox"));
  expect(save).toHaveBeenCalledWith(task, true);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  view.rerender(
    <TaskPanel
      {...props}
      result={{ ...props.result, items: [{ ...task, completed: true }] }}
      canWrite={false}
    />,
  );
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Add task" }),
  ).not.toBeInTheDocument();
});
it("completion failure leaves saved state intact and exposes a safe error", async () => {
  const user = userEvent.setup();
  render(
    <TaskPanel
      result={{
        items: [
          {
            _id: "task" as Task["_id"],
            title: "Review",
            completed: false,
            createdAt: 1,
            revision: 0,
          },
        ],
        hasMore: false,
        limit: 200,
      }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi
        .fn()
        .mockRejectedValue(new Error("FORBIDDEN private backend details"))}
    />,
  );
  await user.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("alert")).toHaveTextContent("Your access");
  expect(screen.getByRole("alert")).not.toHaveTextContent("private backend");
});
it("task filters, editing and conflict recovery preserve a dirty draft", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original title",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  const changeFilter = vi.fn();
  const props = {
    result: { items: [task], hasMore: false, limit: 200 },
    canWrite: true,
    filter: "all" as const,
    changeFilter,
    addTask: vi.fn(),
    setCompleted: vi.fn(),
    updateTask: vi.fn().mockResolvedValue({ taskId: "task", revision: 1 }),
    removeTask: vi.fn(),
  };
  const view = render(<TaskPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "Open" }));
  expect(changeFilter).toHaveBeenCalledWith("open");
  await user.click(screen.getByRole("button", { name: /Edit Original title/ }));
  const input = screen.getByLabelText("Task title");
  await user.clear(input);
  await user.type(input, "My local draft");
  view.rerender(
    <TaskPanel
      {...props}
      result={{
        ...props.result,
        items: [{ ...task, title: "Remote title", revision: 1 }],
      }}
    />,
  );
  expect(screen.getByLabelText("Task title")).toHaveValue("My local draft");
  expect(screen.getByText(/Your draft is kept/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Use latest" }));
  expect(screen.getByLabelText("Task title")).toHaveValue("Remote title");
});
it("removing a task requires a deliberate second confirmation", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Remove me",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  const removeTask = vi.fn().mockResolvedValue("task");
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      removeTask={removeTask}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Remove Remove me/ }));
  expect(screen.getByText(/Remove this task/)).toBeVisible();
  expect(removeTask).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Remove task" }));
  expect(removeTask).toHaveBeenCalledWith(task, 0);
});
it("task edit and removal controls keep keyboard focus in the active flow", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Focus task",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
    />,
  );
  const edit = screen.getByRole("button", { name: "Edit Focus task" });
  await user.click(edit);
  expect(screen.getByLabelText("Task title")).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Edit Focus task" })).toHaveFocus();
  const remove = screen.getByRole("button", { name: "Remove Focus task" });
  await user.click(remove);
  expect(screen.getByRole("group", { name: "Remove Focus task" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Keep task" }));
  expect(screen.getByRole("button", { name: "Remove Focus task" })).toHaveFocus();
});
it("empty task states describe the selected server filter", () => {
  const props = {
    result: { items: [], hasMore: false, limit: 200 },
    canWrite: true,
    ...taskPanelCallbacks(),
    addTask: vi.fn(),
    setCompleted: vi.fn(),
  };
  const view = render(<TaskPanel {...props} filter="open" />);
  expect(screen.getByRole("heading", { name: "No open tasks" })).toBeVisible();
  view.rerender(<TaskPanel {...props} filter="completed" />);
  expect(screen.getByRole("heading", { name: "No completed tasks" })).toBeVisible();
});
it("completion reports a removed task safely at panel level", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Concurrent removal",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn().mockRejectedValue(new Error("TASK_REMOVED private detail"))}
    />,
  );
  await user.click(screen.getByRole("checkbox", { name: "Concurrent removal" }));
  expect(screen.getByRole("alert")).toHaveTextContent("This task was removed");
  expect(screen.getByRole("alert")).not.toHaveTextContent("private detail");
});
it("a two-tab edit keeps its original revision instead of adopting a newer remote revision", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  const updateTask = vi.fn().mockResolvedValue({ taskId: "task", revision: 1 });
  const props = {
    result: { items: [task], hasMore: false, limit: 200 },
    canWrite: true,
    ...taskPanelCallbacks(),
    addTask: vi.fn(),
    setCompleted: vi.fn(),
    updateTask,
  };
  const view = render(<TaskPanel {...props} />);
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  await user.clear(screen.getByLabelText("Task title"));
  await user.type(screen.getByLabelText("Task title"), "My two-tab draft");
  view.rerender(
    <TaskPanel
      {...props}
      result={{ items: [{ ...task, title: "Other tab save", revision: 1 }], hasMore: false, limit: 200 }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(updateTask).toHaveBeenCalledWith(
    expect.objectContaining({ revision: 1 }),
    "My two-tab draft",
    0,
    null,
    null,
  );
});
it("an acknowledged edit does not flag its delayed query echo as a remote conflict", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  const props = {
    result: { items: [task], hasMore: false, limit: 200 },
    canWrite: true,
    ...taskPanelCallbacks(),
    addTask: vi.fn(),
    setCompleted: vi.fn(),
  };
  const view = render(<TaskPanel {...props} />);
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  await user.clear(screen.getByLabelText("Task title"));
  await user.type(screen.getByLabelText("Task title"), "  Acknowledged title  ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  view.rerender(
    <TaskPanel
      {...props}
      result={{ items: [{ ...task, title: "Acknowledged title", revision: 1 }], hasMore: false, limit: 200 }}
    />,
  );
  expect(screen.queryByText(/This task changed elsewhere/)).not.toBeInTheDocument();
});
it("due dates accept real calendar days including leap years and reject impossible dates", () => {
  expect(dueDateProblem("")).toBe("");
  for (const valid of ["2026-09-15", "2024-02-29", "2000-02-29", "2026-01-31", "2026-04-30"]) {
    expect(dueDateProblem(valid)).toBe("");
  }
  for (const invalid of [
    "2025-02-29",
    "1900-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "0000-01-01",
    "2026-9-5",
    "15/09/2026",
    "2026-09-15T00:00",
    "not-a-date",
  ]) {
    expect(dueDateProblem(invalid)).toMatch(/YYYY-MM-DD/);
  }
});
it("task creation sends the due date, displays it and clears both fields on success", async () => {
  const user = userEvent.setup();
  const addTask = vi.fn().mockResolvedValue("task");
  render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={addTask}
      setCompleted={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("New task"), "File returns");
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-15" } });
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask).toHaveBeenCalledWith("File returns", expect.any(String), "2026-09-15", undefined);
  expect(screen.getByLabelText("New task")).toHaveValue("");
  expect(screen.getByLabelText("Due date")).toHaveValue("");
});
it("a backend due-date rejection surfaces safely and keeps the draft", async () => {
  const user = userEvent.setup();
  const addTask = vi.fn().mockRejectedValue(new Error("INVALID_DUE_DATE"));
  render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={addTask}
      setCompleted={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("New task"), "File returns");
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-15" } });
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask).toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("YYYY-MM-DD");
  expect(screen.getByLabelText("New task")).toHaveValue("File returns");
  expect(screen.getByLabelText("Due date")).toHaveValue("2026-09-15");
});
it("the shared editor saves title and date together and clearing sends explicit null", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
    dueDate: "2026-09-15",
  };
  const updateTask = vi.fn().mockResolvedValue({ taskId: "task", revision: 1 });
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      updateTask={updateTask}
    />,
  );
  expect(screen.getByText("Due 2026-09-15")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const editorDate = () => screen.getAllByLabelText("Due date")[1];
  expect(editorDate()).toHaveValue("2026-09-15");
  await user.clear(screen.getByLabelText("Task title"));
  await user.type(screen.getByLabelText("Task title"), "Updated");
  fireEvent.change(editorDate(), { target: { value: "2024-02-29" } });
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({ _id: "task" }), "Updated", 0, "2024-02-29", null);
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const editorDateAgain = () => screen.getAllByLabelText("Due date")[1];
  await user.clear(screen.getByLabelText("Task title"));
  await user.type(screen.getByLabelText("Task title"), "Updated");
  fireEvent.change(editorDateAgain(), { target: { value: "" } });
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({ _id: "task" }), "Updated", 0, null, null);
});
it("a dirty date draft survives a remote change and stale saves keep their baseline revision", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  const updateTask = vi.fn().mockResolvedValue({ taskId: "task", revision: 2 });
  const props = {
    result: { items: [task], hasMore: false, limit: 200 },
    canWrite: true,
    ...taskPanelCallbacks(),
    addTask: vi.fn(),
    setCompleted: vi.fn(),
    updateTask,
  };
  const view = render(<TaskPanel {...props} />);
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const dirtyDate = () => screen.getAllByLabelText("Due date")[1];
  fireEvent.change(dirtyDate(), { target: { value: "2026-09-15" } });
  view.rerender(
    <TaskPanel
      {...props}
      result={{ items: [{ ...task, title: "Remote title", revision: 1 }], hasMore: false, limit: 200 }}
    />,
  );
  expect(dirtyDate()).toHaveValue("2026-09-15");
  expect(screen.getByText(/Your draft is kept/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({ revision: 1 }), "Original", 0, "2026-09-15", null);
});
it("a stale date save keeps its draft and reports the conflict safely", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
    dueDate: "2026-09-15",
  };
  const updateTask = vi.fn().mockRejectedValue(new Error("REVISION_CONFLICT private detail"));
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      updateTask={updateTask}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const staleDate = () => screen.getAllByLabelText("Due date")[1];
  fireEvent.change(staleDate(), { target: { value: "2026-10-01" } });
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("alert")).toHaveTextContent("changed elsewhere");
  expect(screen.getByRole("alert")).not.toHaveTextContent("private detail");
  expect(staleDate()).toHaveValue("2026-10-01");
});
it("task creation retries reuse the key for identical title and date, then rotates after a date edit", async () => {
  const user = userEvent.setup();
  const addTask = vi.fn().mockRejectedValueOnce(new Error("lost response")).mockResolvedValue("task");
  render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={addTask}
      setCompleted={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("New task"), "Review schedule");
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-15" } });
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(screen.getByLabelText("Due date")).toHaveValue("2026-09-15");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask.mock.calls[0]).toEqual(addTask.mock.calls[1]);
  expect(screen.getByLabelText("New task")).toHaveValue("");
  await user.type(screen.getByLabelText("New task"), "Review schedule");
  fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-10-01" } });
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask).toHaveBeenCalledTimes(3);
  expect(addTask.mock.calls[2][2]).toBe("2026-10-01");
  expect(addTask.mock.calls[2][1]).not.toBe(addTask.mock.calls[0][1]);
});
it("viewers see due dates but are offered no date input or edit controls", async () => {
  const task = {
    _id: "task" as Task["_id"],
    title: "Review schedule",
    completed: false,
    createdAt: 1,
    revision: 0,
    dueDate: "2026-09-15",
  };
  const view = render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite={false}
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
    />,
  );
  expect(screen.getByText("Due 2026-09-15")).toBeVisible();
  expect(screen.queryByLabelText("Due date")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Edit Review schedule/ })).not.toBeInTheDocument();
  view.rerender(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite={false}
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
    />,
  );
  expect(screen.queryByLabelText("Due date")).not.toBeInTheDocument();
});
type PickerClient = { _id: string; name: string; archived: boolean };
const clientPickerProps = (options: PickerClient[] = [
  { _id: "client-a", name: "Ava Stone", archived: false },
  { _id: "client-b", name: "Ben Cross", archived: false },
]) => ({
  clientOptions: options as unknown as { _id: Task["clientId"]; name: string; archived: boolean }[],
  clientsStatus: "Exhausted" as const,
  clientSearch: "",
  changeClientSearch: vi.fn(),
  loadMoreClients: vi.fn(),
});
it("task creation sends the linked client and clears it on success", async () => {
  const user = userEvent.setup();
  const addTask = vi.fn().mockResolvedValue("task");
  render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={addTask}
      setCompleted={vi.fn()}
      {...clientPickerProps()}
    />,
  );
  await user.type(screen.getByLabelText("New task"), "Call Ava");
  fireEvent.change(screen.getByLabelText("Client"), { target: { value: "client-a" } });
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask).toHaveBeenCalledWith("Call Ava", expect.any(String), undefined, "client-a");
  expect(screen.getByLabelText("New task")).toHaveValue("");
  expect(screen.getByLabelText("Client")).toHaveValue("");
});
it("the picker shows loading and empty states and offers more clients", async () => {
  const loading = render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      {...clientPickerProps([])}
      clientsStatus="LoadingFirstPage"
    />,
  );
  expect(loading.getByText("Loading clients…")).toBeVisible();
  loading.unmount();
  const empty = render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      {...clientPickerProps([])}
    />,
  );
  expect(empty.getByText(/No clients yet/)).toBeVisible();
  empty.unmount();
  const more = render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      {...clientPickerProps()}
      clientsStatus="CanLoadMore"
    />,
  );
  expect(more.getByRole("button", { name: "More clients" })).toBeVisible();
});
it("the shared editor saves title, date and client together and None clears the link", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
    clientId: "client-a" as Task["clientId"],
    clientName: "Ava Stone",
    clientArchived: false,
  };
  const updateTask = vi.fn().mockResolvedValue({ taskId: "task", revision: 1 });
  const openClient = vi.fn();
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      updateTask={updateTask}
      {...clientPickerProps()}
      openClient={openClient}
    />,
  );
  await user.click(screen.getByRole("button", { name: "View Ava Stone in Clients" }));
  expect(openClient).toHaveBeenCalledWith({ name: "Ava Stone", archived: false });
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const editorClient = () => screen.getAllByLabelText("Client")[1];
  expect(editorClient()).toHaveValue("client-a");
  await user.clear(screen.getByLabelText("Task title"));
  await user.type(screen.getByLabelText("Task title"), "Updated");
  fireEvent.change(editorClient(), { target: { value: "client-b" } });
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(updateTask).toHaveBeenCalledWith(
    expect.objectContaining({ _id: "task" }),
    "Updated",
    0,
    null,
    "client-b",
  );
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const editorClientAgain = () => screen.getAllByLabelText("Client")[1];
  await user.clear(screen.getByLabelText("Task title"));
  await user.type(screen.getByLabelText("Task title"), "Updated");
  fireEvent.change(editorClientAgain(), { target: { value: "" } });
  expect(screen.getAllByRole("option", { name: "None" }).length).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(updateTask).toHaveBeenCalledWith(
    expect.objectContaining({ _id: "task" }),
    "Updated",
    0,
    null,
    null,
  );
});
it("an archived link stays intelligible and stays selectable in the editor", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
    clientId: "client-old" as Task["clientId"],
    clientName: "Old Client",
    clientArchived: true,
  };
  const openClient = vi.fn();
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      {...clientPickerProps()}
      openClient={openClient}
    />,
  );
  await user.click(screen.getByRole("button", { name: "View Old Client in Clients" }));
  expect(openClient).toHaveBeenCalledWith({ name: "Old Client", archived: true });
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const editorClient = () => screen.getAllByLabelText("Client")[1];
  expect(editorClient()).toHaveValue("client-old");
  expect(screen.getByRole("option", { name: "Old Client (archived)" })).toBeInTheDocument();
});
it("a dirty client draft survives a remote change and stale saves keep their baseline", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  const updateTask = vi.fn().mockResolvedValue({ taskId: "task", revision: 2 });
  const props = {
    result: { items: [task], hasMore: false, limit: 200 },
    canWrite: true,
    ...taskPanelCallbacks(),
    addTask: vi.fn(),
    setCompleted: vi.fn(),
    updateTask,
    ...clientPickerProps(),
  };
  const view = render(<TaskPanel {...props} />);
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const dirtyClient = () => screen.getAllByLabelText("Client")[1];
  fireEvent.change(dirtyClient(), { target: { value: "client-b" } });
  view.rerender(
    <TaskPanel
      {...props}
      result={{ items: [{ ...task, title: "Remote title", revision: 1 }], hasMore: false, limit: 200 }}
    />,
  );
  expect(dirtyClient()).toHaveValue("client-b");
  expect(screen.getByText(/Your draft is kept/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(updateTask).toHaveBeenCalledWith(
    expect.objectContaining({ revision: 1 }),
    "Original",
    0,
    null,
    "client-b",
  );
});
it("a stale client save keeps its draft and reports the conflict safely", async () => {
  const user = userEvent.setup();
  const task = {
    _id: "task" as Task["_id"],
    title: "Original",
    completed: false,
    createdAt: 1,
    revision: 0,
    clientId: "client-a" as Task["clientId"],
    clientName: "Ava Stone",
    clientArchived: false,
  };
  const updateTask = vi.fn().mockRejectedValue(new Error("REVISION_CONFLICT private detail"));
  render(
    <TaskPanel
      result={{ items: [task], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
      updateTask={updateTask}
      {...clientPickerProps()}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Edit Original/ }));
  const staleClient = () => screen.getAllByLabelText("Client")[1];
  fireEvent.change(staleClient(), { target: { value: "client-b" } });
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("alert")).toHaveTextContent("changed elsewhere");
  expect(screen.getByRole("alert")).not.toHaveTextContent("private detail");
  expect(staleClient()).toHaveValue("client-b");
});
it("task creation retries rotate the key after a client change", async () => {
  const user = userEvent.setup();
  const addTask = vi.fn().mockRejectedValueOnce(new Error("lost response")).mockResolvedValue("task");
  render(
    <TaskPanel
      result={{ items: [], hasMore: false, limit: 200 }}
      canWrite
      {...taskPanelCallbacks()}
      addTask={addTask}
      setCompleted={vi.fn()}
      {...clientPickerProps()}
    />,
  );
  await user.type(screen.getByLabelText("New task"), "Review schedule");
  fireEvent.change(screen.getByLabelText("Client"), { target: { value: "client-a" } });
  await user.click(screen.getByRole("button", { name: "Add task" }));
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask.mock.calls[0]).toEqual(addTask.mock.calls[1]);
  expect(screen.getByLabelText("New task")).toHaveValue("");
  await user.type(screen.getByLabelText("New task"), "Review schedule");
  fireEvent.change(screen.getByLabelText("Client"), { target: { value: "client-b" } });
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(addTask).toHaveBeenCalledTimes(3);
  expect(addTask.mock.calls[2][3]).toBe("client-b");
  expect(addTask.mock.calls[2][1]).not.toBe(addTask.mock.calls[0][1]);
});
it("viewer projections carry no client identity, links or controls", async () => {
  const redacted = {
    _id: "task" as Task["_id"],
    title: "Linked task",
    completed: false,
    createdAt: 1,
    revision: 0,
  };
  render(
    <TaskPanel
      result={{ items: [redacted], hasMore: false, limit: 200 }}
      canWrite={false}
      {...taskPanelCallbacks()}
      addTask={vi.fn()}
      setCompleted={vi.fn()}
    />,
  );
  expect(screen.queryByText(/Ava Stone/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Client")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /in Clients/ })).not.toBeInTheDocument();
});
