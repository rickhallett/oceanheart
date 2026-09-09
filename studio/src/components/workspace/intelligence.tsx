"use client";
import { useState } from "react";
import { Card, Table, Tabs, SimpleGrid } from "@chakra-ui/react";
import {
  StudioButton,
  StudioInput,
  StudioSelect,
  StudioTextarea,
} from "@/components/studio-controls";
import "./content-chakra.css";
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
        <StudioInput
          name="title"
          required
          placeholder="e.g. Getting to the practice"
        />
      </Field>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} className="ws-form-grid">
        <Field label="Source type">
          <StudioSelect name="kind">
            <option>Document</option>
            <option>Notion</option>
            <option>FAQ page</option>
          </StudioSelect>
        </Field>
        <Field label="Audience">
          <StudioSelect name="audience">
            <option>Public</option>
            <option>Team only</option>
          </StudioSelect>
        </Field>
      </SimpleGrid>
      <Field label="Sample document text">
        <StudioTextarea
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
        <StudioTextarea
          rows={9}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </Field>
      <Field label="Who can this source help?">
        <StudioSelect
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
        </StudioSelect>
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
          <StudioInput
            aria-label="Search knowledge"
            placeholder="Search your practice knowledge…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ws-knowledge-actions">
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
        <Action onClick={() => open("Add practice knowledge", <SourceForm />, "editor")}>
          <Plus size={16} /> Add source
        </Action>
        </div>
      </div>
      <Panel>
        <div className="ws-mobile-records">
          {state.sources
            .filter((s) =>
              (s.title + " " + s.content)
                .toLowerCase()
                .includes(q.toLowerCase()),
            )
            .map((s) => (
              <Card.Root as="article" key={s.id} className="ws-mobile-record">
                <div className="ws-record-title">
                  <FileText size={20} />
                  <span>
                    <strong>{s.title}</strong>
                    <small>
                      {s.kind} · Version {s.version}
                    </small>
                  </span>
                </div>
                <div className="ws-record-meta">
                  <Pill>{s.audience}</Pill>
                  <Pill tone={s.status === "Ready" ? "green" : "amber"}>
                    {s.status}
                  </Pill>
                </div>
                <StudioButton variant="outline" aria-label={`View source: ${s.title}`} onClick={() => open(s.title, <SourceDetail id={s.id} />, "editor")}>View source</StudioButton>
              </Card.Root>
            ))}
        </div>
        <Table.ScrollArea className="ws-desktop-records">
          <Table.Root variant="line" size="lg" className="ws-data-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Source</Table.ColumnHeader>
                <Table.ColumnHeader>Audience</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Action</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {state.sources
                .filter((s) =>
                  (s.title + " " + s.content)
                    .toLowerCase()
                    .includes(q.toLowerCase()),
                )
                .map((s) => (
                  <Table.Row key={s.id}>
                    <Table.Cell>
                      <div className="ws-table-person">
                        <span className="ws-source-icon">
                          <FileText size={21} />
                        </span>
                        <span>
                          <strong>{s.title}</strong>
                          <small>
                            {s.kind} · Version {s.version}
                          </small>
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Pill>{s.audience}</Pill>
                    </Table.Cell>
                    <Table.Cell>
                      <Pill tone={s.status === "Ready" ? "green" : "amber"}>
                        {s.status}
                      </Pill>
                    </Table.Cell>
                    <Table.Cell><StudioButton variant="outline" className="ws-view-source" aria-label={`View source: ${s.title}`} onClick={() => open(s.title, <SourceDetail id={s.id} />, "editor")}>View source</StudioButton></Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
      </Panel>
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
    <Tabs.Root
      value={tab}
      onValueChange={(e) => setTab(e.value)}
      colorPalette="copper"
      variant="line"
    >
      <div className="ws-toolbar">
        <Tabs.List className="ws-content-tabs">
          {["Conversation", "Needs your approval", "History"].map((t) => (
            <Tabs.Trigger key={t} value={t}>
              {t}
              {t === "Needs your approval" && pending.length > 0 && (
                <span className="ws-count">{pending.length}</span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>
      <Tabs.Content value={tab}>
        {tab === "Conversation" ? (
          <div className="ws-assistant-grid">
            <Panel className="ws-chat">
              {conversation.length === 0 && (
                <div className="ws-conversation-empty">
                  <h2>What do you need to know?</h2>
                  <p>Ask about your practice’s policies, services or bookings.</p>
                </div>
              )}
              {conversation.map((c, i) => (
                <div className="ws-chat-turn" key={i}>
                  <Card.Root variant="subtle" className="ws-bubble outgoing">
                    <small>You asked</small>
                    <p>{c.q}</p>
                  </Card.Root>
                  <Card.Root variant="subtle" className="ws-bubble">
                    <small>Answer</small>
                    <p>{c.answer}</p>
                    <div className="ws-answer-actions">
                    {c.citation ? (
                      <StudioButton
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
                            </div>, "reading",
                          )
                        }
                      >
                        <LinkIcon size={13} />
                        {c.citation.title} · v{c.citation.version}
                      </StudioButton>
                    ) : c.sourceId ? (
                      <p className="ws-help">
                        Source snapshot unavailable for this older demo answer.
                      </p>
                    ) : null}
                    <StudioButton
                      className="ws-answer-details"
                      onClick={() => open("Answer details", (
                        <div className="ws-answer-evidence">
                          <h3>{c.q}</h3>
                          <p>How the answer was selected</p>
                          <ol>{c.trace.map((step, index) => <li key={index}>{step}</li>)}</ol>
                        </div>
                      ), "reading")}
                    >
                      Answer details
                    </StudioButton>
                    <StudioButton
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
                      Contact support
                    </StudioButton>
                    </div>
                  </Card.Root>
                </div>
              ))}
              <section className="ws-conversation-compose" aria-label="Message composer">
                <label htmlFor="assistant-question" className="ws-composer-label">{conversation.length ? "Ask another question" : "Ask a question"}</label>
                {conversation.length === 0 && (
                  <div className="ws-starting-questions">
                    {["What is the cancellation policy?", "How much is a reflexology session?"].map(prompt => (
                      <StudioButton key={prompt} onClick={() => ask(prompt)}>{prompt}</StudioButton>
                    ))}
                  </div>
                )}
                <Field label="Answer from">
                  <StudioSelect
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option>Public answers</option>
                    <option>Team knowledge</option>
                  </StudioSelect>
                </Field>
              <form
                className="ws-chat-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(q);
                }}
              >
                <StudioInput
                  id="assistant-question"
                  aria-label="Ask the assistant"
                  placeholder="Ask about your practice…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  required
                />
                <StudioButton aria-label="Ask question" type="submit">
                  Ask
                </StudioButton>
              </form>
              </section>
            </Panel>
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
                <Card.Root variant="subtle" className="ws-approval" key={a.id}>
                  <div className="ws-actions">
                    <Pill tone={a.type === "refund" ? "amber" : ""}>
                      {a.type === "refund"
                        ? "Payment change"
                        : "Outgoing reply"}
                    </Pill>
                    <Pill>{a.status}</Pill>
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.detail}</p>
                  <small>
                    Validation preview: sample client identified · human
                    approval required · no external action
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
                </Card.Root>
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
      </Tabs.Content>
    </Tabs.Root>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={15} />;
}
