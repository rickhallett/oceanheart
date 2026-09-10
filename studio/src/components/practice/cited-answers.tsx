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
        current approved sources and try again.
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
            : "Could not answer. Check that your selected sources are still approved and try again.",
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
        Choose up to five approved sources. Find matching passages, or ask for
        exact excerpts that answer your question.
      </p>
      <fieldset disabled={busy}>
        <legend>Approved sources</legend>
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
          ) && <p>Approve a source to include it here.</p>}
        {sources.status === "CanLoadMore" && (
          <button onClick={() => sources.loadMore(20)}>
            Load more sources
          </button>
        )}
      </fieldset>
      <label className="answer-question">
        Question
        <textarea
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
          Find passages
        </button>
        <button
          disabled={
            busy || !selected.length || !question.trim() || !available?.enabled
          }
          onClick={() => void run(true)}
        >
          Ask with citations
        </button>
      </div>
      {available?.enabled ? (
        <p>
          Asking sends your question and selected excerpts to OpenAI. Answers
          quote sources directly and may abstain. No actions are performed.
        </p>
      ) : (
        <p>
          AI answers are not enabled for this practice. Passage search stays
          within your library.
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
            ? "Not enough consistent evidence"
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
          approved sources.
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
                <p>{c.provenance || "No provenance supplied"}</p>
                <p>
                  Text span {c.start}–{c.end} · exact approved version
                </p>
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
      {result.usage && (
        <p className="answer-usage">
          {result.usage.model} · {result.usage.inputTokens} input /{" "}
          {result.usage.outputTokens} output tokens ·{" "}
          {((result.elapsedMs ?? 0) / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  );
}
