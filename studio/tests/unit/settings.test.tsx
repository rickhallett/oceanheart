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
  await user.click(screen.getByRole("button", { name: "Save settings" }));
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
  await user.click(screen.getByRole("button", { name: "Save settings" }));
  expect(update.mock.calls[0][0]).toEqual({
    tenantId,
    expectedRevision: 2,
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
it("keeps entered values after a failed save and retries with the same revision", async () => {
  const user = userEvent.setup();
  const update = vi
    .fn()
    .mockRejectedValueOnce(new Error("transient detail"))
    .mockResolvedValue(3);
  vi.mocked(useMutation).mockReturnValue(update as never);
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.type(screen.getByLabelText("Tagline (optional)"), " edited");
  await user.click(screen.getByRole("button", { name: "Save settings" }));
  expect(screen.getByLabelText("Tagline (optional)")).toHaveValue(
    "Quiet rooms edited",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("transient detail");
  expect(update).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Save settings" }));
  expect(update).toHaveBeenCalledTimes(2);
  expect(update.mock.calls[0]).toEqual(update.mock.calls[1]);
});
it("a stale update shows a conflict, blocks another save and offers a reload", async () => {
  const user = userEvent.setup();
  const update = vi.fn().mockRejectedValue(new Error("REVISION_CONFLICT"));
  vi.mocked(useMutation).mockReturnValue(update as never);
  render(<PracticeSettings tenantId={tenantId} canWrite />);
  await user.type(screen.getByLabelText("Practice name"), "2");
  await user.click(screen.getByRole("button", { name: "Save settings" }));
  expect(screen.getByRole("alert")).toHaveTextContent("changed since you opened");
  expect(
    screen.getByRole("button", { name: "Reload practice" }),
  ).toBeVisible();
  const save = screen.getByRole("button", { name: "Save settings" });
  expect(save).toBeDisabled();
  await user.click(save).catch(() => {});
  expect(update).toHaveBeenCalledTimes(1);
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