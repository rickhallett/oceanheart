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
  };
  const save = vi.fn().mockResolvedValue("task");
  const props = {
    result: { items: [task], hasMore: false, limit: 200 },
    canWrite: true,
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
          },
        ],
        hasMore: false,
        limit: 200,
      }}
      canWrite
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
