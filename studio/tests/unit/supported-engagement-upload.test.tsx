import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAction, useQuery } from "convex/react";
import { OwnerDocumentIngestion } from "../../src/components/practice/source-library";
import type { TenantId } from "../../src/components/practice/api";

vi.mock("convex/react", () => ({
  useAction: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useConvex: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useAction).mockReset();
  vi.mocked(useQuery).mockReset();
});

function textFile() {
  const file = new File(["Fictional massage practice cancellation guidance."], "massage-guide.txt", {
    type: "text/plain",
    lastModified: 1,
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(await file.text()).buffer,
  });
  return file;
}

it("keeps one upload receipt across a failed acknowledgement and processes the accepted upload", async () => {
  const upload = vi.fn()
    .mockRejectedValueOnce(Error("lost acknowledgement"))
    .mockResolvedValueOnce({ uploadId: "upload-1" });
  const process = vi.fn().mockResolvedValue("source-1");
  vi.mocked(useAction).mockReturnValueOnce(upload as never).mockReturnValueOnce(process as never);
  vi.mocked(useQuery).mockReturnValue(undefined);
  render(<OwnerDocumentIngestion tenantId={"tenant-1" as TenantId} />);
  fireEvent.change(screen.getByLabelText("Document file"), { target: { files: [textFile()] } });
  const submit = screen.getByRole("button", { name: "Upload document" });
  fireEvent.click(submit);
  await screen.findByRole("alert");
  fireEvent.click(submit);
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
  expect(upload.mock.calls[0][0].requestKey).toBe(upload.mock.calls[1][0].requestKey);
  expect(upload.mock.calls[1][0]).toMatchObject({
    tenantId: "tenant-1",
    title: "massage guide",
    provenance: "Uploaded as massage-guide.txt",
    format: "text",
  });
  expect(upload.mock.calls[1][0].bytes.byteLength).toBeGreaterThan(0);
  await waitFor(() => expect(process).toHaveBeenCalledWith({ tenantId: "tenant-1", uploadId: "upload-1" }));
});

it("binds a replacement to the exact source revision and explains approval reset", async () => {
  const upload = vi.fn().mockResolvedValue({ uploadId: "upload-2" });
  const process = vi.fn().mockResolvedValue("source-1");
  vi.mocked(useAction).mockReturnValueOnce(upload as never).mockReturnValueOnce(process as never);
  vi.mocked(useQuery).mockReturnValue(undefined);
  render(<OwnerDocumentIngestion
    tenantId={"tenant-1" as TenantId}
    replacement={{ sourceId: "source-1" as never, title: "Massage practice guide", revision: 3 }}
  />);
  expect(screen.getByText(/successful replacement clears the previous approval/)).toBeVisible();
  const file = new File(["replacement"], "new-guidance.txt", { type: "text/plain" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode("replacement").buffer,
  });
  fireEvent.change(screen.getByLabelText("Document file"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Upload new version" }));
  await waitFor(() => expect(upload).toHaveBeenCalledWith(expect.objectContaining({
    tenantId: "tenant-1",
    targetSourceId: "source-1",
    expectedRevision: 3,
    title: "Massage practice guide",
  })));
});
