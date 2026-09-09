import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CreatePractice,
  TaskPanel,
} from "../../src/components/practice/practice-ui";
import { practiceConfigured } from "../../src/lib/practice-config";
import type { Task } from "../../src/components/practice/api";

const taskPanelCallbacks = () => ({
  filter: "all" as const,
  changeFilter: vi.fn(),
  updateTask: vi.fn().mockResolvedValue({ taskId: "task", revision: 1 }),
  removeTask: vi.fn().mockResolvedValue("task"),
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
  await user.click(screen.getByRole("button", { name: "Use latest title" }));
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
  await user.click(screen.getByRole("button", { name: "Save title" }));
  expect(updateTask).toHaveBeenCalledWith(
    expect.objectContaining({ revision: 1 }),
    "My two-tab draft",
    0,
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
  await user.click(screen.getByRole("button", { name: "Save title" }));
  view.rerender(
    <TaskPanel
      {...props}
      result={{ items: [{ ...task, title: "Acknowledged title", revision: 1 }], hasMore: false, limit: 200 }}
    />,
  );
  expect(screen.queryByText(/This task changed elsewhere/)).not.toBeInTheDocument();
});
