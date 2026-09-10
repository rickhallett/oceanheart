import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import {
  SourceEditor,
  SourceLibrary,
} from "../../src/components/practice/source-library";
import type { TenantId } from "../../src/components/practice/api";
const initial = {
  title: "Synthetic guide",
  provenance: "Fixture",
  format: "markdown" as const,
  content: "Original <script>unsafe()</script>",
};
it("preserves a dirty draft across remote edits until explicit recovery", () => {
  const save = vi.fn(),
    cancel = vi.fn();
  const view = render(
    <SourceEditor initial={initial} revision={0} save={save} cancel={cancel} />,
  );
  fireEvent.change(screen.getByLabelText("Source text"), {
    target: { value: "My unsaved work" },
  });
  view.rerender(
    <SourceEditor
      initial={{ ...initial, content: "Remote version" }}
      revision={1}
      save={save}
      cancel={cancel}
    />,
  );
  expect(screen.getByLabelText("Source text")).toHaveValue("My unsaved work");
  expect(screen.getByRole("button", { name: "Save source" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Load latest version" }));
  expect(screen.getByLabelText("Source text")).toHaveValue("Remote version");
  expect(
    screen.getByRole("button", { name: "Save source" }),
  ).not.toBeDisabled();
});
it("retains a failed draft and reuses exactly the same request key on retry", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(Error("network"))
    .mockResolvedValueOnce(undefined);
  render(
    <SourceEditor
      initial={initial}
      revision={0}
      save={save}
      cancel={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save source" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Source text")).toHaveValue(initial.content);
  fireEvent.click(screen.getByRole("button", { name: "Save source" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0][1]).toBe(save.mock.calls[1][1]);
});
it("never renders imported Markdown as HTML and bounds UTF8 bytes", () => {
  render(<SourceEditor initial={initial} save={vi.fn()} cancel={() => {}} />);
  expect(document.querySelector("script")).toBeNull();
  fireEvent.change(screen.getByLabelText("Source text"), {
    target: { value: "😀".repeat(8193) },
  });
  expect(screen.getByRole("button", { name: "Save source" })).toBeDisabled();
});
it("blocks edits when source is archived remotely", () => {
  const view = render(
    <SourceEditor
      initial={initial}
      revision={0}
      save={vi.fn()}
      cancel={() => {}}
    />,
  );
  view.rerender(
    <SourceEditor
      initial={initial}
      revision={1}
      archived
      save={vi.fn()}
      cancel={() => {}}
    />,
  );
  expect(screen.getByLabelText("Source text")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save source" })).toBeDisabled();
});
it("does not mount private queries for viewers", () => {
  render(<SourceLibrary tenantId={"tenant" as TenantId} canWrite={false} />);
  expect(screen.getByText("Owner access required")).toBeVisible();
  expect(screen.queryByText("Add source")).not.toBeInTheDocument();
});
