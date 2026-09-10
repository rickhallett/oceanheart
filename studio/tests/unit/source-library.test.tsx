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
  fireEvent.change(screen.getByLabelText("Document text"), {
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
  expect(screen.getByLabelText("Document text")).toHaveValue("My unsaved work");
  expect(screen.getByRole("button", { name: "Save document" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Load latest version" }));
  expect(screen.getByLabelText("Document text")).toHaveValue("Remote version");
  expect(
    screen.getByRole("button", { name: "Save document" }),
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
  fireEvent.click(screen.getByRole("button", { name: "Save document" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Document text")).toHaveValue(initial.content);
  fireEvent.click(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0][1]).toBe(save.mock.calls[1][1]);
});
it("never renders imported Markdown as HTML and bounds UTF8 bytes", () => {
  render(<SourceEditor initial={initial} save={vi.fn()} cancel={() => {}} />);
  expect(document.querySelector("script")).toBeNull();
  fireEvent.change(screen.getByLabelText("Document text"), {
    target: { value: "😀".repeat(8193) },
  });
  expect(screen.getByRole("button", { name: "Save document" })).toBeDisabled();
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
  expect(screen.getByLabelText("Document text")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save document" })).toBeDisabled();
});
it("does not mount private queries for viewers", () => {
  render(<SourceLibrary tenantId={"tenant" as TenantId} canWrite={false} />);
  expect(screen.getByText("Owner access required")).toBeVisible();
  expect(screen.queryByText("Add document")).not.toBeInTheDocument();
});

it("picks only editable fields from Convex documents at initialization and latest recovery", async () => {
  const metadata = {
    ...initial,
    _id: "version1",
    _creationTime: 1,
    tenantId: "tenant",
    sourceId: "source",
    hash: "hash",
    number: 1,
    payload: "receipt",
    createdBy: "owner",
  };
  const save = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <SourceEditor
      initial={metadata}
      revision={0}
      save={save}
      cancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Edited title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toEqual({ ...initial, title: "Edited title" });
  expect(Object.keys(save.mock.calls[0][0]).sort()).toEqual([
    "content",
    "format",
    "provenance",
    "title",
  ]);
  const latestDocument = {
    ...metadata,
    _id: "version2",
    number: 2,
    content: "New document",
  };
  view.rerender(
    <SourceEditor
      initial={latestDocument}
      revision={1}
      save={save}
      cancel={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Load latest version" }));
  fireEvent.click(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toEqual({
    ...initial,
    content: "New document",
  });
  expect(Object.keys(save.mock.calls[1][0]).sort()).toEqual([
    "content",
    "format",
    "provenance",
    "title",
  ]);
});
