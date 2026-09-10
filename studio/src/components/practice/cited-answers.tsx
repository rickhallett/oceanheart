"use client";
import { Component, useRef, useState, type ReactNode } from "react";
import {
  useAction,
  useConvex,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "../../../backend/convex/_generated/api";
import type { Id } from "../../../backend/convex/_generated/dataModel";
import type { AnswerResult } from "../../../backend/convex/citedAnswers";
import type { TenantId } from "./api";
import "./source-library.css";
import { PrepareTask } from "./approved-task";

type Result = Pick<AnswerResult, "references" | "citations"> & {
  status: "passages" | "answer" | "abstain";
  elapsedMs?: number;
  usage?: AnswerResult["usage"];
};
class AnswerBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        These sources changed or owner access is no longer available. Choose
        documents currently used in answers and try again.
      </p>
    ) : (
      this.props.children
    );
  }
}
export function CitedAnswers({
  tenantId,
  canWrite,
}: {
  tenantId: TenantId;
  canWrite: boolean;
}) {
  return canWrite ? (
    <AnswerBoundary key={tenantId}>
      <Answers tenantId={tenantId} />
    </AnswerBoundary>
  ) : (
    <p>Answers from the library are private to practice owners.</p>
  );
}
function Answers({ tenantId }: { tenantId: TenantId }) {
  const sources = usePaginatedQuery(
    api.sourceLibrary.list,
    { tenantId, archived: false },
    { initialNumItems: 20 },
  );
  const available = useQuery(api.citedAnswers.availability, { tenantId });
  const client = useConvex(),
    ask = useAction(api.citedAnswers.ask);
  const [selected, setSelected] = useState<Id<"knowledgeSources">[]>([]),
    [question, setQuestion] = useState(""),
    [result, setResult] = useState<Result>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0),
    inFlight = useRef(false);
  function reset() {
    sequence.current++;
    setResult(undefined);
    setError("");
  }
  async function run(generate: boolean) {
    if (inFlight.current) return;
    const ticket = ++sequence.current;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const args = { tenantId, sourceIds: selected, question };
      let next: Result;
      if (generate) next = await ask(args);
      else {
        const found = await client.query(api.citedAnswers.search, args);
        next = {
          status: "passages",
          references: found.references,
          citations: found.passages.map((p) => ({
            sourceId: p.sourceId as Id<"knowledgeSources">,
            versionId: p.versionId as Id<"knowledgeVersions">,
            hash: p.hash,
            start: p.start,
            end: p.end,
          })),
        };
      }
      if (ticket === sequence.current) setResult(next);
    } catch (e) {
      if (ticket === sequence.current)
        setError(
          String(e).includes("PROVIDER_NOT_CONFIGURED")
            ? "Answers are not enabled for this practice. You can still find passages."
            : "Could not answer. Check that your documents are still available for answers and try again.",
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="cited-answers" aria-label="Answers from sources">
      <h2>Ask your library</h2>
      <p>
        Find an answer in your policies, guides and notes. Choose up to five
        documents to look through.
      </p>
      <fieldset disabled={busy}>
        <legend>
          Look in these documents{" "}
          <span className="knowledge-hint">{selected.length}/5 selected</span>
        </legend>
        {sources.results
          .filter(
            (s) =>
              !!s.currentVersionId &&
              s.approvedVersionId === s.currentVersionId,
          )
          .map((s) => (
            <label key={s._id}>
              <input
                type="checkbox"
                checked={selected.includes(s._id)}
                disabled={!selected.includes(s._id) && selected.length >= 5}
                onChange={(e) => {
                  reset();
                  setSelected(
                    e.target.checked
                      ? [...selected, s._id]
                      : selected.filter((id) => id !== s._id),
                  );
                }}
              />
              {s.title}
            </label>
          ))}
        {sources.status === "LoadingFirstPage" && <p>Loading sources…</p>}
        {sources.status === "Exhausted" &&
          !sources.results.some(
            (s) =>
              !!s.currentVersionId &&
              s.approvedVersionId === s.currentVersionId,
          ) && (
            <p>
              Open a document in your library and choose “Use in answers” to
              include it here.
            </p>
          )}
        {sources.status === "CanLoadMore" && (
          <button onClick={() => sources.loadMore(20)}>
            Load more sources
          </button>
        )}
      </fieldset>
      <label className="answer-question">
        What would you like to know?
        <textarea
          placeholder="e.g. How much notice do clients need to cancel?"
          maxLength={400}
          value={question}
          onChange={(e) => {
            reset();
            setQuestion(e.target.value);
          }}
        />
      </label>
      <div className="source-toolbar">
        <button
          disabled={busy || !selected.length || !question.trim()}
          onClick={() => void run(false)}
        >
          Find matching text
        </button>
        <button
          disabled={
            busy || !selected.length || !question.trim() || !available?.enabled
          }
          onClick={() => void run(true)}
        >
          Find an answer
        </button>
      </div>
      {available?.enabled ? (
        <p>
          Your question and selected excerpts are processed by OpenAI. Each
          answer links to the text it comes from.
        </p>
      ) : (
        <p>
          You can search your documents here. AI-assisted answers are not
          enabled for this practice yet.
        </p>
      )}
      {busy && <p role="status">Checking selected sources…</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <AnswerBoundary key={sequence.current}>
          <CurrentAnswer tenantId={tenantId} result={result} />
        </AnswerBoundary>
      )}
    </section>
  );
}
export function CurrentAnswer({
  tenantId,
  result,
}: {
  tenantId: TenantId;
  result: Result;
}) {
  // Reactive authorization/currentness gate: never display the action's cached text.
  const citations = useQuery(api.citedAnswers.resolve, {
    tenantId,
    references: result.references,
    citations: result.citations,
  });
  if (citations === undefined)
    return <p role="status">Verifying current citations…</p>;
  return (
    <div className="cited-result" aria-live="polite">
      <h3>
        {result.status === "answer"
          ? "Answer from your sources"
          : result.status === "abstain"
            ? "No clear answer in these documents"
            : "Matching passages"}
      </h3>
      {result.status === "abstain" ? (
        <p>
          I could not find a supported answer in the selected sources. Check for
          missing or conflicting information.
        </p>
      ) : !citations.length ? (
        <p>
          No matching passages. Try a more specific question or different
          documents.
        </p>
      ) : (
        <ol>
          {citations.map((c, i) => (
            <li key={`${c.versionId}:${c.start}`}>
              <blockquote>{c.text}</blockquote>
              <details>
                <summary>
                  Source {i + 1}: {c.title} · version {c.number}
                </summary>
                <p>{c.provenance || "From your practice library"}</p>
                <p>Saved version {c.number}</p>
                <pre>{c.text}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}
      {result.status === "answer" && citations.length > 0 && (
        <PrepareTask
          tenantId={tenantId}
          evidence={{
            references: result.references,
            citations: result.citations,
          }}
        />
      )}
    </div>
  );
}
