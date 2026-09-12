import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  DocumentUpload,
  UploadProgress,
  WorkflowBrief,
  type WorkflowDraft,
} from "../../src/components/practice/supported-engagement";

const formats = [
  { label: "TXT", extensions: [".txt"], mimeTypes: ["text/plain"], maxBytes: 1024 },
  { label: "PDF", extensions: [".pdf"], mimeTypes: ["application/pdf"], maxBytes: 2048 },
];

it("presents customer-owned upload boundaries and blocks readers from uploading", () => {
  const { rerender } = render(
    <DocumentUpload capability="read" formats={formats} upload={vi.fn()} />,
  );
  expect(screen.getByRole("heading", { name: "Your documents" })).toBeVisible();
  expect(screen.getByText(/authorised Oceanheart delivery team/)).toBeVisible();
  expect(screen.getByText(/reviewed and approved before it can be queried/)).toBeVisible();
  expect(screen.getByText(/do not upload patient records or personal health information/)).toBeVisible();
  expect(screen.queryByLabelText("Document file")).toBeNull();
  rerender(<DocumentUpload capability="owner" formats={formats} upload={vi.fn()} />);
  expect(screen.getByLabelText("Document file")).toHaveAttribute("accept", ".txt,text/plain,.pdf,application/pdf");
});

it("validates advertised file limits and reports failed upload without claiming a document exists", async () => {
  const upload = vi.fn().mockRejectedValue(Error("network"));
  render(<DocumentUpload capability="owner" formats={formats} upload={upload} />);
  const input = screen.getByLabelText("Document file");
  fireEvent.change(input, { target: { files: [new File(["x".repeat(2049)], "large.pdf")] } });
  fireEvent.click(screen.getByRole("button", { name: "Upload document" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("no larger than 2 KB");
  expect(upload).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Document file"), {
    target: { files: [new File(["evidence"], "guide.txt")] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload document" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("file was not added"));
  expect(upload).toHaveBeenCalledTimes(1);
});

it("rejects an unadvertised extension before upload", async () => {
  const upload = vi.fn();
  render(<DocumentUpload capability="owner" formats={formats} upload={upload} />);
  fireEvent.change(screen.getByLabelText("Document file"), {
    target: { files: [new File(["fiction"], "massage-notes.html")] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload document" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a supported file");
  expect(upload).not.toHaveBeenCalled();
});

it("renders processing and typed extraction failures truthfully", () => {
  const { rerender } = render(
    <UploadProgress upload={{ id: "u1", fileName: "guide.pdf", state: "processing" }} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Extracting readable text");
  rerender(<UploadProgress upload={{
    id: "u1", fileName: "scan.pdf", state: "failed", error: "UNREADABLE_SCAN",
  }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("not OCR processed");
});

it("saves a user-authored brief only from selected approved evidence and never implies activation", async () => {
  const prepare = vi.fn().mockResolvedValue(undefined);
  render(<WorkflowBrief
    evidence={[{ sourceId: "s1", title: "Fictional massage practice guide", version: 2 }]}
    prepare={prepare}
    review={vi.fn()}
  />);
  expect(screen.getByText(/does not activate or run a workflow/)).toBeVisible();
  const button = screen.getByRole("button", { name: "Save draft for review" });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/Fictional massage practice guide/));
  fireEvent.change(screen.getByLabelText("Working title"), {
    target: { value: "Weekly exception review" },
  });
  fireEvent.change(screen.getByLabelText("Outcome to explore"), {
    target: { value: "Prepare a weekly exception report for review." },
  });
  fireEvent.click(button);
  await waitFor(() => expect(prepare).toHaveBeenCalledWith({
    title: "Weekly exception review",
    objective: "Prepare a weekly exception report for review.",
    reviewNotes: "",
    sourceIds: ["s1"],
  }));
});

it("reviews a durable user-authored draft only while its evidence remains current", async () => {
  const review = vi.fn().mockResolvedValue(undefined);
  const draft: WorkflowDraft = {
    id: "w1",
    status: "draft",
    title: "Appointment exception review",
    outcome: "Prepare appointment exceptions for a person to review.",
    reviewNotes: "No messages, bookings or payments are changed.",
    revision: 0,
    evidenceState: "current",
    evidence: [{ sourceId: "s1", title: "Fictional massage practice guide", version: 2 }],
  };
  const { rerender } = render(<WorkflowBrief evidence={[]} draft={draft} prepare={vi.fn()} review={review} />);
  expect(screen.getByText("Draft · draft")).toBeVisible();
  expect(screen.getByText("No messages, bookings or payments are changed.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Accept draft" }));
  await waitFor(() => expect(review).toHaveBeenCalledWith("accept", 0));
  expect(screen.getByRole("status")).toHaveTextContent("supported delivery review");

  function Recovery() {
    const [current, setCurrent] = React.useState<WorkflowDraft | undefined>({
      ...draft,
      evidenceState: "unavailable",
    });
    return <WorkflowBrief
      evidence={[{ sourceId: "s2", title: "Current massage practice guide", version: 3 }]}
      draft={current}
      prepare={vi.fn()}
      review={review}
      startNew={() => setCurrent(undefined)}
    />;
  }
  rerender(<Recovery />);
  expect(screen.getByRole("alert")).toHaveTextContent("cannot be reviewed");
  expect(screen.getByRole("button", { name: "Accept draft" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Revise as a new draft" }));
  expect(screen.getByLabelText(/Current massage practice guide/)).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Save draft for review" })).toBeDisabled();
});
