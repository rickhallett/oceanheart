"use client";

import { useRef, useState } from "react";
import "./supported-engagement.css";

export type KnowledgeFormat = {
  label: string;
  extensions: string[];
  mimeTypes: string[];
  maxBytes: number;
};

export type UploadStatus = {
  id: string;
  fileName: string;
  state: "pending" | "processing" | "ready" | "failed";
  error?:
    | "UNSUPPORTED_FORMAT"
    | "FILE_TOO_LARGE"
    | "INVALID_TEXT"
    | "UNREADABLE_SCAN"
    | "EXTRACTION_FAILED";
  sourceTitle?: string;
  version?: number;
};

const uploadErrors: Record<NonNullable<UploadStatus["error"]>, string> = {
  UNSUPPORTED_FORMAT: "This file type is not supported.",
  FILE_TOO_LARGE: "This file is larger than the allowed upload size.",
  INVALID_TEXT: "This file does not contain valid readable text.",
  UNREADABLE_SCAN: "This PDF has no readable text layer. Scanned documents are not OCR processed.",
  EXTRACTION_FAILED: "The document text could not be extracted. Try another supported file.",
};

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${Math.ceil(bytes / (1024 * 1024))} MB`;
}

export function DocumentUpload({
  capability,
  formats,
  latest,
  replacement = false,
  upload,
}: {
  capability: "read" | "contribute" | "owner";
  formats: KnowledgeFormat[];
  latest?: UploadStatus;
  replacement?: boolean;
  upload: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const canUpload = capability === "contribute" || capability === "owner";
  const maxBytes = Math.max(0, ...formats.map((format) => format.maxBytes));
  const accept = formats.flatMap((format) => [...format.extensions, ...format.mimeTypes]).join(",");
  const formatSummary = formats.map((format) => format.label).join(", ");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || lock.current) return;
    if (file.size > maxBytes) {
      setError(`Choose a file no larger than ${size(maxBytes)}.`);
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (!formats.some((format) => format.extensions.some((extension) => lowerName.endsWith(extension)))) {
      setError(`Choose a supported file: ${formatSummary}.`);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await upload(file);
      setFile(undefined);
    } catch {
      setError("The upload could not be started. Your file was not added; try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="engagement-upload" aria-label={replacement ? "Replace document file" : "Your documents"}>
      <h2>{replacement ? "Replace document file" : "Your documents"}</h2>
      <p>
        {replacement
          ? "Upload a new version of this document. The current version remains available unless processing succeeds."
          : "Add the operational documents that should inform this engagement. They are shared only with you and your authorised Oceanheart delivery team."}
      </p>
      <p className="knowledge-hint">
        {replacement && "A successful replacement clears the previous approval. "}
        A document must be reviewed and approved before it can be queried.
        Uploaded content is treated as evidence, never as instructions to run.
        For this supported pilot, do not upload patient records or personal
        health information.
      </p>
      {canUpload ? (
        <form onSubmit={submit}>
          <label>
            Document file
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept={accept}
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                setFile(selected);
                setError("");
              }}
            />
          </label>
          <p className="knowledge-hint">
            Supported: {formatSummary}. Maximum {size(maxBytes)}. PDFs need a
            readable text layer; scanned documents are not OCR processed.
          </p>
          <button className="knowledge-primary" disabled={!file || busy} type="submit">
            {busy ? "Uploading…" : replacement ? "Upload new version" : "Upload document"}
          </button>
        </form>
      ) : (
        <p>You can read documents shared with you. Upload access has not been granted.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {latest && <UploadProgress upload={latest} />}
    </section>
  );
}

export function UploadProgress({ upload }: { upload: UploadStatus }) {
  const message = upload.error
    ? uploadErrors[upload.error]
    : upload.state === "pending"
      ? "Upload received and waiting to be processed."
      : upload.state === "processing"
        ? "Extracting readable text…"
        : upload.state === "ready"
          ? `Ready for review${upload.version ? ` as version ${upload.version}` : ""}.`
          : "The document could not be processed.";
  return (
    <div
      className={`engagement-upload-status engagement-upload-${upload.state}`}
      role={upload.state === "failed" ? "alert" : "status"}
    >
      <strong>{upload.sourceTitle || upload.fileName}</strong>
      <span>{message}</span>
    </div>
  );
}

export type WorkflowEvidence = {
  sourceId: string;
  title: string;
  version: number;
};

export type WorkflowDraft = {
  id: string;
  status: "draft" | "accepted" | "changes_requested";
  title: string;
  summary: string;
  steps: { title: string; responsibility: string; detail: string }[];
  limitations: string[];
  citations: { sourceId: string; title: string; version: number; excerpt: string }[];
};

export function WorkflowBrief({
  evidence,
  draft,
  prepare,
  review,
}: {
  evidence: WorkflowEvidence[];
  draft?: WorkflowDraft;
  prepare: (input: { title: string; objective: string; reviewNotes: string; sourceIds: string[] }) => Promise<void>;
  review: (decision: "accept" | "request_changes") => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(operation: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch {
      setMessage("The workflow brief could not be updated. No workflow was activated.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workflow-brief" aria-labelledby="workflow-brief-heading">
      <h2 id="workflow-brief-heading">Agentic Client Workflow brief</h2>
      <p>
        Write a proposed operational outcome and select the approved evidence
        that supports it. This user-authored note begins a supported review with
        Oceanheart; it does not activate or run a workflow.
      </p>
      {!draft ? (
        <>
          <fieldset disabled={busy}>
            <legend>Approved evidence</legend>
            {evidence.map((source) => (
              <label key={source.sourceId}>
                <input
                  type="checkbox"
                  checked={selected.includes(source.sourceId)}
                  disabled={!selected.includes(source.sourceId) && selected.length >= 5}
                  onChange={(event) => setSelected(event.target.checked
                    ? [...selected, source.sourceId]
                    : selected.filter((id) => id !== source.sourceId))}
                />
                {source.title} · version {source.version}
              </label>
            ))}
          </fieldset>
          {!evidence.length && <p>No approved documents are available yet.</p>}
          <label>
            Working title
            <input
              maxLength={160}
              value={title}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Outcome to explore
            <textarea
              maxLength={400}
              value={objective}
              disabled={busy}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="Describe the recurring operational work and the result that should be reviewed."
            />
          </label>
          <label>
            Limits or questions for review
            <textarea
              maxLength={1000}
              value={reviewNotes}
              disabled={busy}
              onChange={(event) => setReviewNotes(event.target.value)}
              placeholder="Record what must stay manual, uncertain cases, or questions to resolve together."
            />
          </label>
          <button
            className="knowledge-primary"
            disabled={busy || !selected.length || !title.trim() || !objective.trim()}
            onClick={() => void act(
              () => prepare({
                title: title.trim(),
                objective: objective.trim(),
                reviewNotes: reviewNotes.trim(),
                sourceIds: selected,
              }),
              "Draft saved for supported review.",
            )}
          >
            {busy ? "Saving…" : "Save draft for review"}
          </button>
        </>
      ) : (
        <article className="workflow-draft">
          <p className="workflow-draft-label">Reviewed draft · {draft.status.replace("_", " ")}</p>
          <h3>{draft.title}</h3>
          <p>{draft.summary}</p>
          <h4>Proposed steps</h4>
          <ol>
            {draft.steps.map((step) => (
              <li key={`${step.title}:${step.responsibility}`}>
                <strong>{step.title}</strong>
                <span>{step.responsibility}</span>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
          <h4>Limits and review points</h4>
          <ul>{draft.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
          <h4>Evidence used</h4>
          <ol>
            {draft.citations.map((citation) => (
              <li key={`${citation.sourceId}:${citation.version}:${citation.excerpt}`}>
                <blockquote>{citation.excerpt}</blockquote>
                <span>{citation.title} · version {citation.version}</span>
              </li>
            ))}
          </ol>
          {draft.status === "draft" && (
            <div className="source-toolbar">
              <button disabled={busy} onClick={() => void act(
                () => review("accept"), "Draft accepted for supported delivery review.",
              )}>Accept draft</button>
              <button disabled={busy} onClick={() => void act(
                () => review("request_changes"), "Changes requested; no workflow was activated.",
              )}>Request changes</button>
            </div>
          )}
        </article>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
