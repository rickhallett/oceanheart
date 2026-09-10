"use client";
import { Component, useRef, useState, type ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { Doc, Id } from "../../../backend/convex/_generated/dataModel";
import { api } from "../../../backend/convex/_generated/api";
import type { TenantId } from "./api";
import "./source-library.css";
import { TaskApproval, PrepareCompletion } from "./approved-task";
import { BookOpen, FileText, Plus, Search } from "lucide-react";
import { CitedAnswers } from "./cited-answers";

type SourceId = Id<"knowledgeSources">;
type Fields = {
  title: string;
  provenance: string;
  format: "text" | "markdown";
  content: string;
};
function errorText(error: unknown) {
  const text = String(error);
  if (text.includes("REVISION_CONFLICT"))
    return "This document changed elsewhere. Load the latest version before saving or using it in answers.";
  if (text.includes("FORBIDDEN"))
    return "Owner access is required. Your draft has not been saved.";
  if (text.includes("INVALID_SOURCE"))
    return "Enter a title and non-empty text up to 32 KiB. The source description is limited to 500 characters.";
  if (text.includes("SOURCE_ARCHIVED"))
    return "This source is archived and cannot be changed.";
  return "Could not save the change. Your draft is retained; try again.";
}
class LibraryBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>
          The source library could not load. Check your owner access and try
          again.
        </p>
        <button onClick={() => this.setState({ failed: false })}>
          Try again
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function SourceLibrary({
  tenantId,
  canWrite,
  initialSection = "documents",
}: {
  tenantId: TenantId;
  canWrite: boolean;
  initialSection?: "documents" | "answers" | "tasks";
}) {
  return canWrite ? (
    <LibraryBoundary key={tenantId}>
      <Library tenantId={tenantId} initialSection={initialSection} />
    </LibraryBoundary>
  ) : (
    <div className="lp-empty">
      <h2>Owner access required</h2>
      <p>The source library is private to practice owners.</p>
    </div>
  );
}
function Library({
  tenantId,
  initialSection,
}: {
  tenantId: TenantId;
  initialSection: "documents" | "answers" | "tasks";
}) {
  const [archived, setArchived] = useState(false),
    [selected, setSelected] = useState<SourceId>(),
    [adding, setAdding] = useState(false),
    [section, setSection] = useState<"documents" | "answers" | "tasks">(
      initialSection,
    ),
    [search, setSearch] = useState("");
  const sources = usePaginatedQuery(
    api.sourceLibrary.list,
    { tenantId, archived },
    { initialNumItems: 20 },
  );
  const create = useMutation(api.sourceLibrary.create);
  return (
    <section className="source-library">
      <header className="knowledge-header">
        <div>
          <h1>Knowledge library</h1>
          <p>Your practice information, ready when you need it.</p>
        </div>
        {!adding && !selected && section === "documents" && (
          <button className="knowledge-primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add document
          </button>
        )}
      </header>
      <nav className="knowledge-tabs" aria-label="Knowledge sections">
        {(
          [
            ["documents", "Documents"],
            ["answers", "Ask your library"],
            ["tasks", "Tasks"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div hidden={section !== "answers"}>
        <CitedAnswers tenantId={tenantId} canWrite={true} />
      </div>
      <div hidden={section !== "tasks"}>
        <PrepareCompletion tenantId={tenantId} />
      </div>
      <TaskApproval tenantId={tenantId} />
      <div hidden={section !== "documents"}>
        {adding ? (
          <SourceEditor
            save={async (fields, key) => {
              const id = await create({ tenantId, ...fields, requestKey: key });
              setAdding(false);
              setSelected(id);
            }}
            cancel={() => setAdding(false)}
          />
        ) : selected ? (
          <SourceDetail
            key={selected}
            tenantId={tenantId}
            sourceId={selected}
            back={() => setSelected(undefined)}
          />
        ) : (
          <>
            <div className="source-toolbar">
              <label className="knowledge-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search loaded documents"
                  placeholder="Find a document…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="knowledge-filter">
                <span className="sr-only">Show</span>{" "}
                <select
                  value={String(archived)}
                  onChange={(e) => setArchived(e.target.value === "true")}
                >
                  <option value="false">Active documents</option>
                  <option value="true">Archived documents</option>
                </select>
              </label>
            </div>
            {sources.status === "LoadingFirstPage" ? (
              <p role="status">Loading sources…</p>
            ) : !sources.results.length ? (
              <div className="knowledge-empty">
                <BookOpen size={28} aria-hidden="true" />
                <h2>
                  {archived
                    ? "No archived documents"
                    : "A home for your practice knowledge"}
                </h2>
                <p>
                  {archived
                    ? "Documents you archive will appear here."
                    : "Add a policy, a service guide or useful notes. Choose which documents to use when you ask a question."}
                </p>
                {!archived && (
                  <button
                    className="knowledge-primary"
                    onClick={() => setAdding(true)}
                  >
                    Add your first document
                  </button>
                )}
              </div>
            ) : (
              <ul className="source-list">
                {sources.results
                  .filter((s) =>
                    s.title.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((s) => (
                    <li key={s._id}>
                      <FileText
                        className="knowledge-document-icon"
                        size={20}
                        aria-hidden="true"
                      />
                      <button
                        className="knowledge-document-title"
                        onClick={() => setSelected(s._id)}
                      >
                        {s.title}
                      </button>
                      <span>
                        {s.archived
                          ? "Archived"
                          : s.approvedVersionId === s.currentVersionId
                            ? "Used in answers"
                            : "Not used in answers"}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            {search &&
              sources.results.length > 0 &&
              !sources.results.some((s) =>
                s.title.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <p className="knowledge-hint">
                  No matches in the loaded documents. Try another title
                  {sources.status === "CanLoadMore"
                    ? " or load more documents"
                    : ""}
                  .
                </p>
              )}
            {sources.status === "CanLoadMore" && (
              <button onClick={() => sources.loadMore(20)}>
                Load more sources
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
function SourceDetail({
  tenantId,
  sourceId,
  back,
}: {
  tenantId: TenantId;
  sourceId: SourceId;
  back: () => void;
}) {
  const value = useQuery(api.sourceLibrary.get, { tenantId, sourceId });
  const save = useMutation(api.sourceLibrary.save),
    change = useMutation(api.sourceLibrary.changeStatus);
  const [editing, setEditing] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [archiveConfirm, setArchiveConfirm] = useState(false);
  if (!value?.version) return <p role="status">Loading source…</p>;
  const { source, version } = value;
  async function status(action: "approve" | "revoke" | "archive") {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await change({
        tenantId,
        sourceId,
        expectedRevision: source.revision,
        versionId: version!._id,
        action,
      });
      setArchiveConfirm(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button disabled={pending} onClick={back}>
        Back to documents
      </button>
      <h2>{source.title}</h2>
      <p>
        Version {version.number} ·{" "}
        {source.archived
          ? "Archived"
          : source.approvedVersionId === version._id
            ? "Used in answers"
            : "Not used in answers"}{" "}
      </p>
      {error && <p role="alert">{error}</p>}
      {editing ? (
        <SourceEditor
          initial={version}
          revision={source.revision}
          archived={source.archived}
          save={async (fields, key, revision) => {
            await save({
              tenantId,
              sourceId,
              ...fields,
              requestKey: key,
              expectedRevision: revision!,
            });
            setEditing(false);
          }}
          cancel={() => setEditing(false)}
        />
      ) : (
        <>
          <p>{version.provenance || ""}</p>
          {!source.archived && (
            <div className="source-toolbar">
              <button disabled={pending} onClick={() => setEditing(true)}>
                Edit document
              </button>
              <button
                className="document-answer-switch"
                role="switch"
                aria-checked={source.approvedVersionId === version._id}
                disabled={pending}
                onClick={() =>
                  status(
                    source.approvedVersionId === version._id
                      ? "revoke"
                      : "approve",
                  )
                }
              >
                <span aria-hidden="true" className="document-switch-track" />
                Use in answers
              </button>
              <button
                disabled={pending}
                onClick={() => setArchiveConfirm(true)}
              >
                Archive document
              </button>
            </div>
          )}
          <pre className="source-text">{version.content}</pre>
          {archiveConfirm && (
            <div role="group" aria-label="Confirm archive">
              <p>
                Archive this document? It will no longer be used in answers. You
                can still read its previous versions.
              </p>
              <button disabled={pending} onClick={() => status("archive")}>
                Confirm archive
              </button>
              <button
                disabled={pending}
                onClick={() => setArchiveConfirm(false)}
              >
                Keep document
              </button>
            </div>
          )}
          <details>
            <summary>Version history</summary>
            <VersionHistory tenantId={tenantId} sourceId={sourceId} />
          </details>
        </>
      )}
    </>
  );
}
function VersionHistory({
  tenantId,
  sourceId,
}: {
  tenantId: TenantId;
  sourceId: SourceId;
}) {
  const versions = usePaginatedQuery(
    api.sourceLibrary.versions,
    { tenantId, sourceId },
    { initialNumItems: 10 },
  );
  const [selected, setSelected] = useState<Id<"knowledgeVersions">>();
  const historical = useQuery(
    api.sourceLibrary.version,
    selected ? { tenantId, sourceId, versionId: selected } : "skip",
  );
  return (
    <>
      <ul className="source-list">
        {versions.results.map((v) => (
          <li key={v._id}>
            <button onClick={() => setSelected(v._id)}>
              View version {v.number}: {v.title}
            </button>
            <small>Saved version {v.number}</small>
          </li>
        ))}
      </ul>
      {versions.status === "CanLoadMore" && (
        <button onClick={() => versions.loadMore(10)}>
          Load older versions
        </button>
      )}
      {historical && (
        <section aria-label="Historical version">
          <h3>Version {historical.number}</h3>
          <p>{historical.provenance}</p>
          <pre className="source-text">{historical.content}</pre>
        </section>
      )}
    </>
  );
}
function editorFields(value?: Fields): Fields {
  return {
    title: value?.title ?? "",
    provenance: value?.provenance ?? "",
    format: value?.format ?? "text",
    content: value?.content ?? "",
  };
}
export function SourceEditor({
  initial,
  revision,
  archived = false,
  save,
  cancel,
}: {
  initial?: Fields;
  revision?: number;
  archived?: boolean;
  save: (fields: Fields, key: string, revision?: number) => Promise<void>;
  cancel: () => void;
}) {
  const [fields, setFields] = useState<Fields>(() => editorFields(initial));
  const [baseline, setBaseline] = useState(revision);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false),
    receipt = useRef({ payload: "", key: "" });
  const stale = baseline !== revision;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || stale || archived) return;
    busy.current = true;
    setPending(true);
    setError("");
    const payload = JSON.stringify({ fields, baseline });
    if (receipt.current.payload !== payload)
      receipt.current = { payload, key: crypto.randomUUID() };
    try {
      await save(editorFields(fields), receipt.current.key, baseline);
    } catch (e) {
      setError(errorText(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function loadFile(file?: File) {
    if (!file) return;
    try {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 32768) throw Error();
      const content = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (content.includes("\0")) throw Error();
      setFields((f) => ({
        ...f,
        content,
        format: /\.md$/i.test(file.name) ? "markdown" : "text",
        provenance: file.name,
      }));
      setError("");
    } catch {
      setError("Choose a UTF-8 .txt or .md file up to 32 KiB.");
    }
  }
  return (
    <form onSubmit={submit} className="source-editor">
      <h2>{initial ? "Edit document" : "Add document"}</h2>
      <p className="knowledge-hint">
        Keep a policy, guide or reference in one place.
      </p>
      {error && <p role="alert">{error}</p>}
      {(stale || archived) && (
        <p role="alert">
          This document changed elsewhere. Your draft is retained.
          {!archived && (
            <button
              type="button"
              onClick={() => {
                setFields(editorFields(initial));
                setBaseline(revision);
                setError("");
              }}
            >
              Load latest version
            </button>
          )}
        </p>
      )}
      <fieldset disabled={pending || archived}>
        <label>
          Title
          <input
            placeholder="e.g. Cancellation policy"
            required
            maxLength={160}
            value={fields.title}
            onChange={(e) => setFields({ ...fields, title: e.target.value })}
          />
        </label>
        <label>
          Document text
          <textarea
            required
            rows={12}
            value={fields.content}
            onChange={(e) => setFields({ ...fields, content: e.target.value })}
          />
        </label>
        <details className="document-options">
          <summary>Import a file or add document details</summary>
          <div className="document-options-grid">
            {" "}
            <label>
              Where it came from (optional)
              <input
                maxLength={500}
                value={fields.provenance}
                onChange={(e) =>
                  setFields({ ...fields, provenance: e.target.value })
                }
              />
            </label>
            <label>
              Format
              <select
                value={fields.format}
                onChange={(e) =>
                  setFields({
                    ...fields,
                    format: e.target.value as Fields["format"],
                  })
                }
              >
                <option value="text">Plain text</option>
                <option value="markdown">Markdown</option>
              </select>
            </label>
            <label>
              Import text file
              <input
                type="file"
                accept=".txt,.md"
                onChange={(e) => loadFile(e.target.files?.[0])}
              />
            </label>
          </div>
        </details>
        <p>
          After saving, choose “Use in answers” to make this version available
          to your library assistant.
        </p>
        <div className="source-toolbar">
          <button
            disabled={
              stale ||
              !fields.content.trim() ||
              new TextEncoder().encode(fields.content).length > 32768
            }
            type="submit"
          >
            {pending ? "Saving…" : "Save document"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
