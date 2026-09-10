import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { ClientNotes, NotesEditor } from "../../src/components/practice/client-notes";
import type { Client, ClientNotesValue, TenantId } from "../../src/components/practice/api";
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
const tenantId = "tenant-a" as TenantId;
const client = { _id: "client-a", name: "Alex", archived: false, revision: 0, createdAt: 1 } as Client;
const save = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useQuery).mockReturnValue({ text: "Original", revision: 1 });
  vi.mocked(useMutation).mockReturnValue(save as never);
});
it("loads notes on demand and keeps unsaved text through hide/reopen", () => {
  render(<ClientNotes tenantId={tenantId} client={client} />);
  expect(useQuery).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "View private notes" }));
  expect(vi.mocked(useQuery).mock.calls[0][1]).toEqual({ tenantId, clientId: client._id });
  fireEvent.change(screen.getByLabelText("Private notes"), { target: { value: "Draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide private notes" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View private notes" }));
  expect(screen.getByRole("textbox")).toHaveValue("Draft");
});
it("keeps dirty draft on remote update and requires explicit recovery", () => {
  const view = render(<NotesEditor notes={{ text: "Original", revision: 1 }} save={save} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "My draft" } });
  view.rerender(<NotesEditor notes={{ text: "Remote", revision: 2 }} save={save} />);
  expect(screen.getByRole("textbox")).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "Save notes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Use latest notes" }));
  expect(screen.getByRole("textbox")).toHaveValue("Remote");
  expect(save).not.toHaveBeenCalled();
});
it("adopts clean remote updates without marking the form dirty", () => {
  const view = render(<NotesEditor notes={{ text: "Original", revision: 1 }} save={save} />);
  view.rerender(<NotesEditor notes={{ text: "Remote", revision: 2 }} save={save} />);
  expect(screen.getByRole("textbox")).toHaveValue("Remote");
  expect(screen.getByRole("button", { name: "Save notes" })).toBeDisabled();
});
it("uses mutation revision across delayed subscription echoes and can clear notes", async () => {
  save.mockResolvedValueOnce({ text: "Saved", revision: 2 }).mockResolvedValueOnce({ text: "", revision: 3 });
  render(<NotesEditor notes={{ text: "Original", revision: 1 }} save={save} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Saved" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Private notes saved."));
  expect(screen.getByRole("textbox")).toHaveValue("Saved");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
  await waitFor(() => expect(save).toHaveBeenLastCalledWith("", 2));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Private notes cleared."));
});
it("retains rejected draft and waits for a fresh query before recovering a conflict", async () => {
  save.mockRejectedValue(new Error("REVISION_CONFLICT"));
  const view = render(<NotesEditor notes={{ text: "Original", revision: 1 }} save={save} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Rejected draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Use latest notes" })).toBeDisabled());
  expect(screen.getByRole("textbox")).toHaveValue("Rejected draft");
  view.rerender(<NotesEditor notes={{ text: "Authoritative", revision: 2 }} save={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Use latest notes" }));
  expect(screen.getByRole("textbox")).toHaveValue("Authoritative");
});
it("prevents overlapping saves while pending and keeps ordinary failures retryable", async () => {
  let reject!: (e: Error) => void;
  save.mockImplementation(() => new Promise<ClientNotesValue>((_, fail) => { reject = fail; }));
  render(<NotesEditor notes={{ text: "", revision: 0 }} save={save} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pending" } });
  fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
  expect(screen.getByRole("textbox")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await act(async () => reject(new Error("Disconnected")));
  expect(screen.getByRole("textbox")).toHaveValue("Pending");
  expect(screen.getByRole("button", { name: "Save notes" })).toBeEnabled();
  expect(save).toHaveBeenCalledTimes(1);
});
