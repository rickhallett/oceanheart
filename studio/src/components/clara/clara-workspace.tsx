"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { Shell } from "@/components/workspace/workspace";
import { signOutPractice } from "@/app/practice/actions";
import type {
  ClaraAdaptationState,
  ClaraBrowserResponse,
  ClaraDraft,
  ClaraRun,
  ClaraTraceSummary,
} from "@/lib/clara-contract";
import "./clara-workspace.css";

const storageKey = "oceanheart:clara-fictional-run:v1";
const runIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requestClara(body: object): Promise<ClaraBrowserResponse> {
  const response = await fetch("/api/private/clara", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 401) throw new Error("SESSION_REQUIRED");
  if (!response.ok) throw new Error("CLARA_UNAVAILABLE");
  return response.json() as Promise<ClaraBrowserResponse>;
}

function pounds(minor: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(minor / 100);
}

function poundsToMinor(value: string) {
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) return null;
  const [pounds, pence = ""] = value.split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

export function ClaraWorkspace({ ownerName }: { ownerName: string }) {
  const [run, setRun] = useState<ClaraRun>();
  const [draft, setDraft] = useState<ClaraDraft>();
  const [trace, setTrace] = useState<ClaraTraceSummary>();
  const [adaptation, setAdaptation] = useState<ClaraAdaptationState>();
  const [busy, setBusy] = useState(false);
  const [adaptationBusy, setAdaptationBusy] = useState(false);
  const [error, setError] = useState("");
  const [adaptationError, setAdaptationError] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("2026-09-01");
  const [newRate, setNewRate] = useState("90.00");

  const inspect = useCallback(async (runId: string) => {
    setBusy(true);
    setError("");
    setDraft(undefined);
    setTrace(undefined);
    try {
      const runResponse = await requestClara({ operation: "run", runId });
      if (runResponse.operation !== "run") throw new Error("INVALID_RESPONSE");
      setRun(runResponse.run);
      const [draftResponse, traceResponse] = await Promise.all([
        requestClara({ operation: "draft", runId }),
        requestClara({ operation: "trace", runId }),
      ]);
      if (draftResponse.operation !== "draft" || traceResponse.operation !== "trace")
        throw new Error("INVALID_RESPONSE");
      setDraft(draftResponse.draft);
      setTrace(traceResponse.trace);
    } catch (reason) {
      if (reason instanceof Error && reason.message === "SESSION_REQUIRED") {
        window.location.assign("/sign-in");
        return;
      }
      setError("The draft could not be loaded. Try again when the private runtime is available.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void requestClara({ operation: "adaptation-status" })
      .then((response) => {
        if (response.operation === "adaptation-status") setAdaptation(response.adaptation);
      })
      .catch(() => setAdaptationError("Rate changes are not available right now."));
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && runIdPattern.test(saved)) void inspect(saved);
    } catch {
      setError("This browser cannot remember the draft. Keep this page open while reviewing it.");
    }
  }, [inspect]);

  async function adaptationAction(body: object) {
    setAdaptationBusy(true);
    setAdaptationError("");
    try {
      const response = await requestClara(body);
      if (
        response.operation !== "adaptation-status" &&
        response.operation !== "adaptation-evaluate" &&
        response.operation !== "adaptation-activate" &&
        response.operation !== "adaptation-rollback"
      ) throw new Error("INVALID_RESPONSE");
      setAdaptation(response.adaptation);
      return response.adaptation;
    } catch (reason) {
      if (reason instanceof Error && reason.message === "SESSION_REQUIRED") {
        window.location.assign("/sign-in");
        return;
      }
      setAdaptationError("The rate change could not be completed. The current rule remains active.");
    } finally {
      setAdaptationBusy(false);
    }
  }

  async function evaluateRateChange() {
    const newRateMinor = poundsToMinor(newRate);
    if (newRateMinor === null) {
      setAdaptationError("Enter a GBP rate with no more than two decimal places.");
      return;
    }
    await adaptationAction({ operation: "adaptation-evaluate", effectiveDate, newRateMinor });
  }

  async function activateRateChange() {
    const proposal = adaptation?.proposal;
    if (!proposal?.evaluation.accepted) return;
    const state = await adaptationAction({
      operation: "adaptation-activate",
      proposalId: proposal.proposalId,
      expectedActiveReleaseId: proposal.expectedActiveReleaseId,
    });
    if (state) {
      setRun(undefined);
      setDraft(undefined);
      setTrace(undefined);
      try { localStorage.removeItem(storageKey); } catch { /* Server state remains authoritative. */ }
    }
  }

  async function rollbackRateChange() {
    if (!adaptation?.rollbackTarget) return;
    const state = await adaptationAction({
      operation: "adaptation-rollback",
      targetReleaseId: adaptation.rollbackTarget.releaseId,
      expectedActiveReleaseId: adaptation.active.releaseId,
    });
    if (state) {
      setRun(undefined);
      setDraft(undefined);
      setTrace(undefined);
      try { localStorage.removeItem(storageKey); } catch { /* Server state remains authoritative. */ }
    }
  }

  async function prepare() {
    setBusy(true);
    setError("");
    setDraft(undefined);
    setTrace(undefined);
    try {
      const response = await requestClara({ operation: "prepare" });
      if (response.operation !== "prepare") throw new Error("INVALID_RESPONSE");
      setRun(response.run);
      try {
        localStorage.setItem(storageKey, response.run.runId);
      } catch {
        // The durable server receipt remains authoritative for this request.
      }
      await inspect(response.run.runId);
    } catch (reason) {
      if (reason instanceof Error && reason.message === "SESSION_REQUIRED") {
        window.location.assign("/sign-in");
        return;
      }
      setError("The invoice draft could not be prepared. Nothing was sent or charged.");
      setBusy(false);
    }
  }

  return (
    <div className="ws-root ws-live clara-instance">
      <Shell
        view="assistant"
        live={{
          practiceName: "Clara",
          ownerName,
          role: "Private demonstration",
          go: () => window.scrollTo(0, 0),
          href: () => "/app",
          focused: {
            title: "Invoice preparation",
            navigationLabel: "Invoice preparation",
          },
          account: (
            <form className="ws-live-account" action={signOutPractice}>
              <button type="submit">Sign out</button>
            </form>
          ),
          content: (
            <section className="clara-workflow" aria-labelledby="clara-title">
              <header>
                <p className="ws-date-label">Fictional Clara demonstration</p>
                <h1 id="clara-title">Prepare September’s invoice draft</h1>
                <p>
                  Review three fictional session records, then prepare a private draft. This does not send an invoice, collect payment or contact anyone.
                </p>
              </header>

              <section className="clara-ledger" aria-labelledby="clara-ledger-title">
                <div className="clara-section-heading">
                  <FileText aria-hidden="true" size={18} />
                  <h2 id="clara-ledger-title">Session ledger</h2>
                </div>
                <dl>
                  <div><dt>3 September</dt><dd>Attended · Fictional agreement · £80.00</dd></div>
                  <div><dt>10 September</dt><dd>Cancelled · Fictional policy · £40.00</dd></div>
                  <div><dt>17 September</dt><dd>Attended · Prepaid · £0.00 due</dd></div>
                </dl>
              </section>

              <section className="clara-adaptation" aria-labelledby="clara-adaptation-title">
                <p className="ws-date-label">Supported rule change</p>
                <h2 id="clara-adaptation-title">Change the standard attended-session rate</h2>
                <p>
                  This demonstration evaluates one defined rate rule. It does not interpret general instructions, change negotiated rates, cancellation charges or prepaid sessions.
                </p>
                <div className="clara-rate-fields">
                  <label>
                    Effective from
                    <input
                      type="date"
                      value={effectiveDate}
                      disabled={adaptationBusy}
                      onChange={(event) => setEffectiveDate(event.target.value)}
                    />
                  </label>
                  <label>
                    New standard rate (GBP)
                    <input
                      inputMode="decimal"
                      value={newRate}
                      disabled={adaptationBusy}
                      onChange={(event) => setNewRate(event.target.value)}
                    />
                  </label>
                </div>
                <div className="clara-actions">
                  <button className="ws-button" type="button" disabled={adaptationBusy} onClick={() => void evaluateRateChange()}>
                    {adaptationBusy ? "Working…" : "Evaluate change"}
                  </button>
                  {adaptation?.proposal?.evaluation.accepted && (
                    <button className="ws-button ws-button-primary" type="button" disabled={adaptationBusy} onClick={() => void activateRateChange()}>
                      Activate evaluated change
                    </button>
                  )}
                  {adaptation?.rollbackTarget && (
                    <button className="ws-button" type="button" disabled={adaptationBusy} onClick={() => void rollbackRateChange()}>
                      Roll back to {adaptation.rollbackTarget.version}
                    </button>
                  )}
                </div>
                {adaptationError && <p role="alert" className="clara-error">{adaptationError}</p>}
                {adaptation && (
                  <p className="clara-configuration">
                    Active rule: <strong>{adaptation.active.version}</strong> · generation {adaptation.active.generation}
                  </p>
                )}
                {adaptation?.proposal && (
                  <section className="clara-proposal" aria-labelledby="clara-proposal-title">
                    <p className="ws-date-label">Evaluated proposal</p>
                    <h3 id="clara-proposal-title">
                      {pounds(adaptation.proposal.baselineTotalMinor)} → {pounds(adaptation.proposal.candidateTotalMinor)}
                    </h3>
                    <p>{adaptation.proposal.explanation}</p>
                    <p>
                      Evaluation: {adaptation.proposal.evaluation.passed}/{adaptation.proposal.evaluation.total} checks passed
                      {adaptation.proposal.evaluation.accepted ? ". Ready for your explicit activation." : ". Not accepted; activation is unavailable."}
                    </p>
                  </section>
                )}
              </section>

              <div className="clara-actions">
                <button className="ws-button ws-button-primary" type="button" disabled={busy} onClick={() => void prepare()}>
                  <Sparkles aria-hidden="true" size={16} />
                  {busy ? "Preparing…" : run ? "Retry safely" : "Prepare invoice draft"}
                </button>
                {run && (
                  <button className="ws-button" type="button" disabled={busy} onClick={() => void inspect(run.runId)}>
                    Reload result
                  </button>
                )}
              </div>

              {error && <p role="alert" className="clara-error">{error}</p>}
              {run && (
                <p role="status" className="clara-status">
                  Draft run: <strong>{run.status.replaceAll("_", " ")}</strong>
                </p>
              )}

              {draft && (
                <section className="clara-result" aria-labelledby="clara-result-title">
                  <p className="ws-date-label">Prepared draft</p>
                  <h2 id="clara-result-title">Total {pounds(draft.totalMinor)}</h2>
                  <ul>
                    {draft.lines.map((line) => (
                      <li key={line.sessionId}>
                        <span>{line.sessionId.replace("clara-session-", "Session ")}</span>
                        <strong>{pounds(line.amountMinor)}</strong>
                      </li>
                    ))}
                  </ul>
                  {draft.prepaidSessionIds.length > 0 && (
                    <p>{draft.prepaidSessionIds.length} prepaid session excluded from the amount due.</p>
                  )}
                  {draft.unresolved.length > 0 && (
                    <p>{draft.unresolved.length} session needs review before this draft is ready.</p>
                  )}
                  <p className="clara-receipt">
                    Durable receipt {draft.draftId.slice(0, 18)}…
                    {trace && ` · ${trace.eventCount} trace events · ${trace.configurationVersion}`}
                  </p>
                </section>
              )}
            </section>
          ),
        }}
      />
    </div>
  );
}
