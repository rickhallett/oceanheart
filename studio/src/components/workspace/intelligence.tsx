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
    const words = value.toLowerCase().match(/[a-z]{4,}/g) || [];
    const allowed = state.sources.filter(
      (s) =>
        s.status === "Ready" &&
        (scope === "Team knowledge" || s.audience === "Public"),
    );
    const ranked = allowed
      .map((s) => ({
        s,
        score: words.filter((w) =>
          (s.title + " " + s.content).toLowerCase().includes(w),
        ).length,
      }))
      .sort((a, b) => b.score - a.score);
    const found = ranked[0]?.score ? ranked[0].s : undefined;
    const clinical = /diagnos|cure|symptom|medicat|pregnan|pain|treat my/i.test(
      value,
    );
    update((d) => {
      d.chatHistory.push({
        q: value,
        answer: clinical
          ? "This needs Amelia’s judgement. I won’t suggest clinical advice. You can hand this question to your studio partner with the conversation attached."
          : found
            ? `Here is the relevant passage from your practice knowledge:\n\n${found.content}`
            : "I don’t know from the available practice information. Add an approved source or ask your studio partner to help.",
        sourceId: clinical ? undefined : found?.id,
        trace: [
          `Audience filter: ${scope}`,
          `${allowed.length} ready sources considered`,
          "Local keyword match (prototype, not live RAG)",
          found && !clinical
            ? `Source: ${found.title} · v${found.version}`
            : "No supported answer returned",
        ],
      });
    });
    setQ("");
  }
  function decision(id: string, approved: boolean) {
    update(
      (d) => {
        const a = d.approvals.find((a) => a.id === id)!;
        a.status = approved ? "Approved" : "Declined";
        if (approved && a.type === "reply" && a.messageId) {
          const m = d.inbox.find((m) => m.id === a.messageId)!;
          m.messages.push(a.detail);
          m.status = "Replied";
        }
        if (approved && a.type === "refund") {
          const p = d.payments.find(
            (p) => p.id === a.paymentId && p.status === "Paid",
          );
          if (p) p.status = "Refunded";
        }
        d.activity.unshift(
          `${approved ? "Approved" : "Declined"} · ${a.title} · simulated action`,
        );
      },
      approved
        ? "Approved and applied to the sample practice."
        : "Action declined. No change applied.",
    );
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
                Explore sourced answers, missing information and a human
                handoff.
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
                  {c.sourceId && (
                    <button
                      className="ws-citation"
                      onClick={() =>
                        open(
                          "Source evidence",
                          <SourceDetail id={c.sourceId!} />,
                        )
                      }
                    >
                      <LinkIcon size={13} />
                      {state.sources.find((s) => s.id === c.sourceId)?.title}
                    </button>
                  )}
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
