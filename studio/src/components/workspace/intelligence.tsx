"use client";
import { useState } from "react";
import {
  ArrowRight,
  Plus,
  RefreshCw,
  FileText,
  BookOpen,
  Check,
  ShieldCheck,
  Link as LinkIcon,
  Send,
  Search,
} from "lucide-react";
import { useStudio, Panel, Pill, Empty, Action, Field } from "./context";
import { uid, type Source } from "./model";
function SourceForm() {
  const { update, close } = useStudio();
  return (
    <form
      className="ws-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        update((d) => {
          d.sources.push({
            id: uid(),
            title: String(f.get("title")),
            kind: String(f.get("kind")),
            audience: String(f.get("audience")) as Source["audience"],
            status: "Needs sync",
            version: 1,
            content: String(f.get("content")),
          });
        }, "Source added. Sync it to make it available in the sample assistant.");
        close();
      }}
    >
      <Field label="Source title">
        <input
          name="title"
          required
          placeholder="e.g. Getting to the practice"
        />
      </Field>
      <div className="ws-form-grid">
        <Field label="Source type">
          <select name="kind">
            <option>Document</option>
            <option>Notion</option>
            <option>FAQ page</option>
          </select>
        </Field>
        <Field label="Audience">
          <select name="audience">
            <option>Public</option>
            <option>Team only</option>
          </select>
        </Field>
      </div>
      <Field label="Sample document text">
        <textarea
          name="content"
          rows={7}
          required
          placeholder="Paste fictional practice information to explore indexing and search."
        />
      </Field>
      <p className="ws-help">
        Content stays in this browser. File parsing and Notion access are
        represented by this text-based mock.
      </p>
      <Action type="submit">Add source</Action>
    </form>
  );
}
export function SourceDetail({ id }: { id: string }) {
  const { state, update } = useStudio();
  const s = state.sources.find((s) => s.id === id)!;
  const [content, setContent] = useState(s.content);
  return (
    <div className="ws-form">
      <div className="ws-actions">
        <Pill>{s.kind}</Pill>
        <Pill>{s.audience}</Pill>
        <Pill>Version {s.version}</Pill>
        <Pill tone={s.status === "Ready" ? "green" : "amber"}>{s.status}</Pill>
      </div>
      <Field label="Document content">
        <textarea
          rows={9}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </Field>
      <Field label="Who can this source help?">
        <select
          value={s.audience}
          onChange={(e) =>
            update((d) => {
              const x = d.sources.find((x) => x.id === id)!;
              x.audience = e.target.value as Source["audience"];
              x.status = "Needs sync";
            })
          }
        >
          <option>Public</option>
          <option>Team only</option>
        </select>
      </Field>
      <div className="ws-actions">
        <Action
          onClick={() =>
            update((d) => {
              const x = d.sources.find((x) => x.id === id)!;
              x.content = content;
              x.status = "Needs sync";
            }, "Changes saved. Re-sync before the assistant uses them.")
          }
        >
          Save changes
        </Action>
        <Action
          secondary
          onClick={() =>
            update((d) => {
              const x = d.sources.find((x) => x.id === id)!;
              x.content = content;
              x.status = "Ready";
              x.version++;
              d.activity.unshift(
                `Knowledge synced · ${x.title} · v${x.version}`,
              );
            }, "Sample source synced.")
          }
        >
          <RefreshCw size={15} /> Sync source
        </Action>
      </div>
      <p className="ws-help">
        Sync is simulated. Public-ready sources can be searched by the sample
        assistant; team-only sources stay out of its public answers.
      </p>
    </div>
  );
}
export function Knowledge() {
  const { state, update, open } = useStudio();
  const [q, setQ] = useState("");
  return (
    <>
      <div className="ws-toolbar">
        <div className="ws-search">
          <Search size={17} />
          <input
            aria-label="Search knowledge"
            placeholder="Search your practice knowledge…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Action onClick={() => open("Add practice knowledge", <SourceForm />)}>
          <Plus size={16} /> Add source
        </Action>
      </div>
      <div className="ws-info-strip">
        <BookOpen size={21} />
        <div>
          <strong>Useful answers begin with what you know.</strong>
          <p>
            Policies, service details and the questions you answer again and
            again.
          </p>
        </div>
        <Action
          secondary
          onClick={() =>
            update((d) => {
              d.sources.forEach((s) => {
                if (s.status === "Needs sync") {
                  s.status = "Ready";
                  s.version++;
                }
              });
              d.activity.unshift("Knowledge · all sample sources synced");
            }, "All sample sources synced.")
          }
        >
          <RefreshCw size={14} /> Sync all
        </Action>
      </div>
      <Panel>
        {state.sources
          .filter((s) =>
            (s.title + " " + s.content).toLowerCase().includes(q.toLowerCase()),
          )
          .map((s) => (
            <button
              className="ws-source-row"
              key={s.id}
              onClick={() => open(s.title, <SourceDetail id={s.id} />)}
            >
              <span className="ws-source-icon">
                <FileText size={21} />
              </span>
              <div>
                <h3>{s.title}</h3>
                <p>
                  {s.kind} · {s.audience} · Version {s.version}
                </p>
              </div>
              <Pill tone={s.status === "Ready" ? "green" : "amber"}>
                {s.status}
              </Pill>
              <ArrowRight size={16} />
            </button>
          ))}
      </Panel>
      <p className="ws-footnote">
        Explore a stale-source journey: edit a document, save it, then sync it.
        The status and version change in the demo.
      </p>
    </>
  );
}
export function Assistant() {
  const { state, update, open } = useStudio();
  const [q, setQ] = useState("");
  const conversation = state.chatHistory;
  const [tab, setTab] = useState("Conversation");
  const [scope, setScope] = useState("Public answers");
  const pending = state.approvals.filter((a) => a.status === "Pending");
  function ask(value: string) {
    if (!value.trim()) return;
    // This is a deliberately closed demonstration, not a clinical classifier or
    // general retrieval system. Unknown and mixed-intent questions abstain.
    const examples: Record<string, { sourceId: string; passage: string }> = {
      "what is the cancellation policy": {
        sourceId: "k1",
        passage:
          "Clients can reschedule or cancel without charge with at least 24 hours’ notice. Changes within 24 hours are reviewed personally by Amelia.",
      },
      "how much is a reflexology session": {
        sourceId: "k2",
        passage: "A reflexology session lasts 60 minutes and costs £65.",
      },
      "where is the practice": {
        sourceId: "k2",
        passage: "The practice is in Bristol.",
      },
      "where is the online session link": {
        sourceId: "k2",
        passage:
          "Online session links are included in the booking confirmation.",
      },
    };
    const example =
      examples[
        value
          .trim()
          .toLowerCase()
          .replace(/[?!.]+$/, "")
      ];
    const allowed = state.sources.filter(
      (s) =>
        s.status === "Ready" &&
        (scope === "Team knowledge" || s.audience === "Public"),
    );
    const found =
      example &&
      allowed.find(
        (s) => s.id === example.sourceId && s.content.includes(example.passage),
      );
    update((d) => {
      d.chatHistory.push({
        q: value,
        answer: found
          ? `Here is the supported administrative passage from your practice knowledge:\n\n${example.passage}`
          : "I can’t answer this from the supported administrative examples. This scripted demo only covers cancellation policy, session price, practice location and online joining links. For clinical questions or anything else, ask a person to help.",
        sourceId: found ? found.id : undefined,
        citation: found
          ? {
              id: found.id,
              title: found.title,
              version: found.version,
              content: found.content,
              audience: found.audience,
            }
          : undefined,
        trace: [
          `Audience filter: ${scope}`,
          `${allowed.length} ready sources considered`,
          "Exact administrative example and approved passage match (scripted demo)",
          found
            ? `Source: ${found.title} · v${found.version}`
            : "No supported answer returned",
        ],
      });
    });
    setQ("");
  }
  function decision(id: string, approved: boolean) {
    update((d) => {
      const a = d.approvals.find((a) => a.id === id);
      if (!a || a.status !== "Pending") return;
      if (!approved) {
        a.status = "Declined";
        d.activity.unshift(`Declined · ${a.title} · no action applied`);
        return;
      }
      const alreadyApplied = d.approvals.some(
        (other) =>
          other.id !== id &&
          other.status === "Approved" &&
          other.type === a.type &&
          (a.type === "refund"
            ? other.paymentId === a.paymentId
            : other.messageId === a.messageId),
      );
      const message =
        a.type === "reply"
          ? d.inbox.find((m) => m.id === a.messageId)
          : undefined;
      const payment =
        a.type === "refund"
          ? d.payments.find((p) => p.id === a.paymentId)
          : undefined;
      const valid =
        !alreadyApplied &&
        (a.type === "reply"
          ? !!message &&
            message.status !== "Replied" &&
            message.reply === a.detail &&
            !!a.detail.trim()
          : !!payment &&
            payment.status === "Paid" &&
            Number.isFinite(a.amount) &&
            (a.amount ?? 0) > 0 &&
            a.amount === payment.amount);
      if (!valid) {
        a.status = "Declined";
        a.detail +=
          "\n\nNot applied: this request is stale, already completed, or no longer matches the sample record. Prepare a new request after reviewing it.";
        d.activity.unshift(
          `Not applied · ${a.title} · current record validation failed`,
        );
        return;
      }
      if (message) {
        message.messages.push(a.detail);
        message.status = "Replied";
      }
      if (payment) payment.status = "Refunded";
      a.status = "Approved";
      d.activity.unshift(`Approved · ${a.title} · simulated action applied`);
    }, "Decision checked against the latest sample records. See History for the outcome.");
  }
  return (
    <>
      <div className="ws-toolbar">
        <div className="ws-segment">
          {["Conversation", "Needs your approval", "History"].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
              {t === "Needs your approval" && pending.length > 0 && (
                <span className="ws-count">{pending.length}</span>
              )}
            </button>
          ))}
        </div>
        <Pill>
          <span className="ws-dot" /> Scripted demo
        </Pill>
      </div>
      {tab === "Conversation" ? (
        <div className="ws-assistant-grid">
          <Panel className="ws-chat">
            <div className="ws-assistant-intro">
              <span className="ws-assistant-mark">
                <ShieldCheck size={25} />
              </span>
              <h2>
                A little help.
                <br />
                Your judgement, always.
              </h2>
              <p>
                Explore four supported administrative questions and a human
                handoff. All other questions abstain.
              </p>
            </div>
            {conversation.map((c, i) => (
              <div className="ws-chat-turn" key={i}>
                <div className="ws-bubble outgoing">
                  <p>{c.q}</p>
                </div>
                <div className="ws-bubble">
                  <small>Studio assistant · example response</small>
                  <p>{c.answer}</p>
                  {c.citation ? (
                    <button
                      className="ws-citation"
                      onClick={() =>
                        open(
                          "Source evidence",
                          <div className="ws-form">
                            <Pill>Version {c.citation!.version}</Pill>
                            <h3>{c.citation!.title}</h3>
                            <p>{c.citation!.content}</p>
                            <p className="ws-help">
                              Saved source snapshot from this answer. Later
                              edits and syncs do not change this evidence.
                            </p>
                          </div>,
                        )
                      }
                    >
                      <LinkIcon size={13} />
                      {c.citation.title} · v{c.citation.version}
                    </button>
                  ) : c.sourceId ? (
                    <p className="ws-help">
                      Source snapshot unavailable for this older demo answer.
                    </p>
                  ) : null}
                  <details>
                    <summary>How this answer was selected</summary>
                    {c.trace.map((t) => (
                      <p key={t}>{t}</p>
                    ))}
                  </details>
                  <button
                    className="ws-link"
                    onClick={() =>
                      update((d) => {
                        d.tickets.push({
                          id: "ST-" + uid().slice(0, 4),
                          title: c.q,
                          status: "Open",
                          messages: [
                            `Question: ${c.q}`,
                            `Assistant context: ${c.answer}`,
                          ],
                        });
                      }, "Question and context added to your support conversation.")
                    }
                  >
                    Ask a person to help <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
            <form
              className="ws-chat-input"
              onSubmit={(e) => {
                e.preventDefault();
                ask(q);
              }}
            >
              <input
                aria-label="Ask the assistant"
                placeholder="Ask about your practice…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                required
              />
              <button aria-label="Ask question" type="submit">
                <ArrowRight size={20} />
              </button>
            </form>
          </Panel>
          <div>
            <Panel title="Try a few real situations">
              <div className="ws-prompt-list">
                {[
                  "What is the cancellation policy?",
                  "How much is a reflexology session?",
                  "Do you offer home visits?",
                  "Can you diagnose my symptoms?",
                ].map((p) => (
                  <button key={p} onClick={() => ask(p)}>
                    {p}
                    <ArrowUpRightIcon />
                  </button>
                ))}
              </div>
              <Field label="Knowledge audience">
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option>Public answers</option>
                  <option>Team knowledge</option>
                </select>
              </Field>
            </Panel>
            <div className="ws-explainer">
              <h3>Before anything happens</h3>
              <p>
                Replies and refunds go through your approval queue. The live
                service would validate identity, permission and action details
                before execution.
              </p>
              <button
                className="ws-link"
                onClick={() => setTab("Needs your approval")}
              >
                Review {pending.length} pending action
                {pending.length !== 1 ? "s" : ""} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Panel
          title={
            tab === "History"
              ? "Decisions you’ve made"
              : "A person makes the call"
          }
        >
          {state.approvals
            .filter((a) =>
              tab === "History"
                ? a.status !== "Pending"
                : a.status === "Pending",
            )
            .map((a) => (
              <div className="ws-approval" key={a.id}>
                <div className="ws-actions">
                  <Pill tone={a.type === "refund" ? "amber" : ""}>
                    {a.type === "refund" ? "Payment change" : "Outgoing reply"}
                  </Pill>
                  <Pill>{a.status}</Pill>
                </div>
                <h3>{a.title}</h3>
                <p>{a.detail}</p>
                <small>
                  Validation preview: sample client identified · human approval
                  required · no external action
                </small>
                {a.status === "Pending" && (
                  <div className="ws-actions">
                    <Action onClick={() => decision(a.id, true)}>
                      <Check size={15} /> Approve in demo
                    </Action>
                    <Action secondary onClick={() => decision(a.id, false)}>
                      Decline
                    </Action>
                  </div>
                )}
              </div>
            ))}
          {(tab === "History"
            ? state.approvals.filter((a) => a.status !== "Pending")
            : pending
          ).length === 0 && (
            <Empty
              title="All clear here"
              body="Prepare a reply in Enquiries to try the approval journey."
            />
          )}
        </Panel>
      )}
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={15} />;
}
