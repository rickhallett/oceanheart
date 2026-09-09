import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { PracticeSettings } from "../../src/components/practice/settings";
import type {
  PracticeSettings as Settings,
  TenantId,
} from "../../src/components/practice/api";
vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));
const tenantId = "settings-tenant" as TenantId;
const settings: Settings = {
  name: "Seaside Studio",
  tagline: "Quiet rooms",
  contactEmail: "hello@example.com",
  contactPhone: "01234 567890",
  address: "1 Seaside Road",
  revision: 2,
  availability: {
    monday: { open: "09:00", close: "17:30" },
    tuesday: null,
    wednesday: { open: "09:30", close: "13:00" },
    thursday: { open: "09:00", close: "17:00" },
    friday: { open: "09:00", close: "17:00" },
    saturday: null,
    sunday: null,
  },
};
const remote: Settings = {
  name: "Seaside Studio",
  tagline: "Remote edit",
  contactEmail: "remote@example.com",
  revision: 3,
  availability: {
    monday: { open: "08:00", close: "16:00" },
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  },
};
const legacy: Settings = {
  name: "Legacy practice",
  revision: 0,
  availability: {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  vi.mocked(useQuery).mockReturnValue(settings);
});
function dayToggle(day: string) {
  return screen.getByRole("checkbox", { name: day });
}
function saveButton() {
  return screen.getByRole("button", { name: "Save settings" });
}
it("loads and shows saved details with the enabled weekdays and time zone note", () => {
  render(
    <PracticeSettings
      tenantId={tenantId}
      canWrite
      timeZone="Europe/London"
    />,
  );
  expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(screen.getByLabelText("Practice name")).toHaveValue("Seaside Studio");
  expect(screen.getByLabelText("Contact email (optional)")).toHaveValue(
    "hello@example.com",
  );
  expect(dayToggle("Monday")).toBeChecked();
  expect(dayToggle("Tuesday")).not.toBeChecked();
  expect(screen.getByLabelText("Wednesday opening time")).toHaveValue("09:30");
  expect(screen.getByLabelText("Wednesday closing time")).toHaveValue("13:00");
  expect(screen.getByText(/Europe\/London/)).toBeVisible();
});
it("legacy practices without settings open as all days closed with empty details", () => {
  vi.mocked(useQuery).mockReturnValue(legacy);
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  expect(screen.getByLabelText("Practice name")).toHaveValue("Legacy practice");
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue("");
  for (const day of [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]) {
    expect(dayToggle(day)).not.toBeChecked();
  }
  expect(screen.getByLabelText("Monday opening time")).toBeDisabled();
});
it("turning a closed day on applies the 09:00–17:00 defaults", async () => {
  const user = userEvent.setup();
  vi.mocked(useQuery).mockReturnValue(legacy);
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.click(dayToggle("Tuesday"));
  expect(screen.getByLabelText("Tuesday opening time")).toHaveValue("09:00");
  expect(screen.getByLabelText("Tuesday closing time")).toHaveValue("17:00");
});
it("validates time order and never sends an inverted interval", async () => {
  const user = userEvent.setup();
  const update = vi.fn().mockResolvedValue(3);
  vi.mocked(useMutation).mockReturnValue(update as never);
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  fireEvent.change(screen.getByLabelText("Monday opening time"), {
    target: { value: "17:30" },
  });
  await user.click(saveButton());
  expect(screen.getByRole("alert")).toHaveTextContent(
    "opening time before its closing time",
  );
  expect(update).not.toHaveBeenCalled();
});
it("sends a trimmed payload with one interval per open day and omits blanks", async () => {
  const user = userEvent.setup();
  const update = vi.fn().mockResolvedValue(3);
  vi.mocked(useMutation).mockReturnValue(update as never);
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.clear(screen.getByLabelText("Tagline (optional)"));
  await user.type(screen.getByLabelText("Tagline (optional)"), "  New line  ");
  await user.clear(screen.getByLabelText("Contact email (optional)"));
  await user.click(dayToggle("Tuesday"));
  await user.click(saveButton());
  expect(update.mock.calls[0][0]).toEqual({
    tenantId,
    expectedRevision: 2,
    expectedTimeZone: null,
    name: "Seaside Studio",
    tagline: "New line",
    contactPhone: "01234 567890",
    address: "1 Seaside Road",
    availability: {
      monday: { open: "09:00", close: "17:30" },
      tuesday: { open: "09:00", close: "17:00" },
      wednesday: { open: "09:30", close: "13:00" },
      thursday: { open: "09:00", close: "17:00" },
      friday: { open: "09:00", close: "17:00" },
      saturday: null,
      sunday: null,
    },
  });
  expect(screen.getByRole("status")).toHaveTextContent("Settings saved.");
});
it("keeps entered values after a failed save and retries with the same snapshot", async () => {
  const user = userEvent.setup();
  const update = vi
    .fn()
    .mockRejectedValueOnce(new Error("transient detail"))
    .mockResolvedValue(3);
  vi.mocked(useMutation).mockReturnValue(update as never);
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.type(screen.getByLabelText("Tagline (optional)"), " edited");
  await user.click(saveButton());
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Quiet rooms edited",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("transient detail");
  expect(update).toHaveBeenCalledTimes(1);
  await user.click(saveButton());
  expect(update).toHaveBeenCalledTimes(2);
  expect(update.mock.calls[0]).toEqual(update.mock.calls[1]);
});
it("a remote revision keeps the draft, conflicts the stale save and reloads explicitly", async () => {
  const user = userEvent.setup();
  let reject!: (reason?: unknown) => void;
  const gate = new Promise<number>((_resolve, rej) => {
    reject = rej;
  });
  const update = vi.fn().mockReturnValue(gate);
  vi.mocked(useMutation).mockReturnValue(update as never);
  const view = render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.type(screen.getByLabelText("Tagline (optional)"), " edited");
  await user.click(saveButton());
  expect(update).toHaveBeenCalledTimes(1);
  vi.mocked(useQuery).mockReturnValue(remote);
  view.rerender(<PracticeSettings tenantId={tenantId} canWrite />);
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Quiet rooms edited",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("changed elsewhere");
  expect(
    screen.queryByRole("button", { name: "Save settings" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Load latest settings" }),
  ).toBeVisible();
  reject(new Error("REVISION_CONFLICT"));
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0]).toMatchObject({
    tenantId,
    expectedRevision: 2,
    expectedTimeZone: null,
  });
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Quiet rooms edited",
  );
  await user.click(
    screen.getByRole("button", { name: "Load latest settings" }),
  );
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Remote edit",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(saveButton()).toBeEnabled();
});
it("a successful save establishes the baseline so its echo never conflicts", async () => {
  const user = userEvent.setup();
  const update = vi.fn().mockResolvedValue(3);
  vi.mocked(useMutation).mockReturnValue(update as never);
  const saved: Settings = {
    ...settings,
    tagline: "Quiet rooms edited",
    revision: 3,
  };
  const view = render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.type(screen.getByLabelText("Tagline (optional)"), " edited");
  await user.click(saveButton());
  expect(update.mock.calls[0][0]).toMatchObject({
    expectedRevision: 2,
    expectedTimeZone: null,
  });
  expect(screen.getByRole("status")).toHaveTextContent("Settings saved.");
  vi.mocked(useQuery).mockReturnValue(saved);
  view.rerender(<PracticeSettings tenantId={tenantId} canWrite />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Load latest settings" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Quiet rooms edited",
  );
  expect(saveButton()).toBeEnabled();
});
it("a tenant switch at the same revision never leaks the prior draft", async () => {
  const user = userEvent.setup();
  vi.mocked(useQuery).mockReturnValue(legacy);
  const other: Settings = {
    name: "Other practice",
    revision: 0,
    availability: {
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    },
  };
  const view = render(
    <PracticeSettings tenantId={tenantId} canWrite />,
  );
  await user.type(screen.getByLabelText("Tagline (optional)"), "A draft");
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue("A draft");
  vi.mocked(useQuery).mockReturnValue(other);
  view.rerender(
    <PracticeSettings tenantId={"other" as TenantId} canWrite />,
  );
  expect(screen.getByLabelText("Practice name")).toHaveValue("Other practice");
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue("");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("a time zone change under a dirty form conflicts until explicitly reloaded", async () => {
  const user = userEvent.setup();
  const update = vi.fn().mockResolvedValue(3);
  vi.mocked(useMutation).mockReturnValue(update as never);
  const view = render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.type(screen.getByLabelText("Tagline (optional)"), " edited");
  vi.mocked(useQuery).mockReturnValue({ ...settings, timeZone: "Europe/London" });
  view.rerender(<PracticeSettings tenantId={tenantId} canWrite />);
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Quiet rooms edited",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("time zone changed");
  expect(
    screen.queryByRole("button", { name: "Save settings" }),
  ).not.toBeInTheDocument();
  expect(update).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Load latest settings" }),
  );
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Quiet rooms",
  );
  expect(screen.getByText(/Europe\/London/)).toBeVisible();
  expect(saveButton()).toBeEnabled();
});
it("a clean form adopts a time zone change without a conflict", async () => {
  const user = userEvent.setup();
  vi.mocked(useMutation).mockReturnValue(vi.fn() as never);
  const view = render(<PracticeSettings tenantId={tenantId} canWrite />);
  vi.mocked(useQuery).mockReturnValue({ ...settings, timeZone: "Europe/London" });
  view.rerender(<PracticeSettings tenantId={tenantId} canWrite />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText(/Europe\/London/)).toBeVisible();
  expect(saveButton()).toBeEnabled();
  await user.click(saveButton());
});
it("viewers see the saved values read-only without owner actions", () => {
  render(<PracticeSettings tenantId={tenantId} canWrite={false} />);
  expect(screen.getByText("View-only access")).toBeVisible();
  expect(screen.getByLabelText("Practice name")).toBeDisabled();
  expect(dayToggle("Tuesday")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Save settings" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Discard changes" }),
  ).not.toBeInTheDocument();
});
it("mounts only the settings query and never client or task commands", () => {
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  const calls = vi.mocked(useQuery).mock.calls;
  expect(calls).toHaveLength(1);
  expect(getFunctionName(calls[0]![0])).toBe("settings:get");
  expect(calls[0]![1]).toEqual({ tenantId });
});