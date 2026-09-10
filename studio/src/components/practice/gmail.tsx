"use client";
import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  gmailApi,
  type GmailStatus,
  type GmailPreview,
  type GmailMessage,
} from "./gmail-api";
import { type TenantId, readableError } from "./api";
import type { EnquiryId } from "./enquiry-api";
export function PracticeGmail({
  tenantId,
  returnStatus,
  openEnquiry,
}: {
  tenantId: TenantId;
  returnStatus?: string;
  openEnquiry: (id: EnquiryId) => void;
}) {
  const [disconnectWarning, setDisconnectWarning] = useState("");
  const status = useQuery(gmailApi.status, { tenantId }),
    disconnect = useAction(gmailApi.disconnect),
    list = useAction(gmailApi.list),
    preview = useAction(gmailApi.preview),
    importMessage = useAction(gmailApi.import);
  if (!status) return <p role="status">Loading Gmail connection…</p>;
  return (
    <GmailPanel
      key={`${tenantId}:${status.generation}`}
      tenantId={tenantId}
      status={status}
      returnStatus={returnStatus}
      connectionNotice={disconnectWarning}
      disconnect={async () => {
        const result = await disconnect({ tenantId });
        setDisconnectWarning(
          result.providerRevoked
            ? ""
            : "Local access removed. Google revocation could not be confirmed; remove access in your Google account if needed.",
        );
        return result;
      }}
      list={(pageToken) =>
        list({ tenantId, ...(pageToken ? { pageToken } : {}) })
      }
      preview={(messageId) => preview({ tenantId, messageId })}
      importMessage={(messageId) => importMessage({ tenantId, messageId })}
      openEnquiry={openEnquiry}
    />
  );
}
export function GmailPanel({
  tenantId,
  status,
  returnStatus,
  disconnect,
  list,
  preview,
  importMessage,
  openEnquiry,
  connectionNotice,
}: {
  tenantId: TenantId;
  status: GmailStatus;
  connectionNotice?: string;
  returnStatus?: string;
  disconnect: () => Promise<{ providerRevoked: boolean }>;
  list: (
    pageToken?: string,
  ) => Promise<{ items: GmailMessage[]; nextPageToken?: string }>;
  preview: (id: string) => Promise<GmailPreview>;
  importMessage: (
    id: string,
  ) => Promise<{ enquiryId: EnquiryId; alreadyImported: boolean }>;
  openEnquiry: (id: EnquiryId) => void;
}) {
  const [items, setItems] = useState<GmailMessage[]>([]),
    [next, setNext] = useState<string>(),
    [browsed, setBrowsed] = useState(false),
    [selected, setSelected] = useState<GmailPreview>(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [imported, setImported] = useState<EnquiryId>();
  const active = useRef(true),
    busy = useRef(false),
    previewPanel = useRef<HTMLElement>(null),
    previewTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) previewPanel.current?.focus();
  }, [selected]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function run(work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      if (active.current) setError(readableError(cause));
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }
  async function browse(pageToken?: string) {
    await run(async () => {
      const result = await list(pageToken);
      if (!active.current) return;
      setItems((previous) =>
        pageToken
          ? [
              ...previous,
              ...result.items.filter(
                (item) => !previous.some((old) => old.id === item.id),
              ),
            ]
          : result.items,
      );
      setNext(result.nextPageToken);
      setBrowsed(true);
    });
  }
  return (
    <section className="lp-gmail">
      <header className="lp-mail-heading">
        <div>
          <span className="lp-eyebrow">EMAIL CONNECTION</span>
          <h2>Gmail</h2>
        </div>
        <span className="lp-mail-access">Read-only</span>
      </header>
      <p>
        Read-only connection. Browse a page, preview a message, then import only
        the message you choose as an enquiry. Nothing is sent or marked read.
      </p>
      {connectionNotice && <p role="status">{connectionNotice}</p>}
      {returnStatus === "denied" && (
        <p role="status">Google connection was cancelled. You can try again.</p>
      )}
      {returnStatus === "failed" && (
        <p role="alert">
          Gmail connection could not be completed. Try connecting again.
        </p>
      )}
      <p>
        {status.connected
          ? `Connected to ${status.mailbox ?? "Gmail"}`
          : status.needsReconnect
            ? "Gmail access expired or was revoked. Reconnect to continue."
            : "Gmail is not connected."}
      </p>
      <div className="lp-actions lp-mail-actions">
        {status.connected && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void browse()}
          >
            Browse Gmail messages
          </button>
        )}
        {!status.connected && (
          <form action="/practice/integrations/gmail/connect" method="post">
            <input type="hidden" name="tenantId" value={tenantId} />
            <button type="submit" disabled={pending}>
              {status.needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}
            </button>
          </form>
        )}
        {status.connected && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(async () => {
                const result = await disconnect();
                if (!active.current) return;
                setItems([]);
                setSelected(undefined);
                setImported(undefined);
                setBrowsed(false);
                setNotice(
                  result.providerRevoked
                    ? "Gmail disconnected."
                    : "Local access removed. Google revocation could not be confirmed; remove access in your Google account if needed.",
                );
              })
            }
          >
            Disconnect Gmail
          </button>
        )}
      </div>
      {status.connected && (
        <>
          {browsed && !items.length && <p>No messages on this page.</p>}
          {!browsed && (
            <div className="lp-mail-empty">
              <h3>Your inbox, ready to review</h3>
              <p>Browse your messages, then select one to preview it here.</p>
            </div>
          )}
          <div
            className={`lp-mail-workspace${selected ? " lp-mail-workspace-selected" : ""}`}
          >
            <div className="lp-mail-list-pane">
              {browsed && (
                <p className="lp-mail-list-label">
                  {items.length} messages loaded
                </p>
              )}
              <ul className="lp-mail-list" aria-label="Gmail messages">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      className="lp-gmail-message"
                      aria-pressed={selected?.id === item.id}
                      type="button"
                      disabled={pending}
                      onClick={(event) => {
                        previewTrigger.current = event.currentTarget;
                        void run(async () => {
                          const result = await preview(item.id);
                          if (active.current) {
                            setSelected(result);
                            setImported(undefined);
                            setNotice("");
                          }
                        });
                      }}
                    >
                      <span className="lp-mail-avatar" aria-hidden="true">
                        {(
                          item.from
                            .replace(/<.*>/, "")
                            .replace(/"/g, "")
                            .trim() || "?"
                        )
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                      <span className="lp-mail-row-copy">
                        <span className="lp-mail-row-meta">
                          <span className="lp-mail-sender">
                            {item.from || "Unknown sender"}
                          </span>
                          <span className="lp-mail-date" title={item.date}>
                            {mailDate(item.date)}
                          </span>
                        </span>
                        <span className="lp-mail-subject">
                          {item.subject || "(No subject)"}
                        </span>
                        {item.snippet && (
                          <span className="lp-mail-snippet">
                            {item.snippet}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {next && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void browse(next)}
                >
                  Load more messages
                </button>
              )}
            </div>
            {selected && (
              <section
                ref={previewPanel}
                tabIndex={-1}
                className="lp-gmail-preview"
                aria-label="Message preview"
              >
                <div className="lp-mail-preview-toolbar">
                  <span className="lp-eyebrow">MESSAGE PREVIEW</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setSelected(undefined);
                      setImported(undefined);
                      previewTrigger.current?.focus();
                    }}
                  >
                    Close preview
                  </button>
                </div>
                <h3>{selected.subject || "(No subject)"}</h3>
                <dl className="lp-mail-envelope">
                  <div>
                    <dt>From</dt>
                    <dd>{selected.from || "Unknown sender"}</dd>
                  </div>
                  <div>
                    <dt>Received</dt>
                    <dd>{selected.date || "Date unavailable"}</dd>
                  </div>
                </dl>
                <p className="lp-enquiry-message">
                  {selected.text ||
                    selected.snippet ||
                    "No readable text content."}
                </p>
                {selected.bodyTruncated && (
                  <p className="lp-muted">
                    Message text is truncated. Check Gmail for the full
                    original.
                  </p>
                )}
                {!selected.plainTextAvailable && (
                  <p role="status">
                    This message has no plain-text body and cannot be imported.
                    Open it in Gmail to review the original.
                  </p>
                )}
                {selected.hasAttachments && (
                  <p className="lp-muted">Attachments are not imported.</p>
                )}
                <button
                  type="button"
                  disabled={pending || !selected.plainTextAvailable}
                  onClick={() =>
                    void run(async () => {
                      const result = await importMessage(selected.id);
                      if (active.current) {
                        setImported(result.enquiryId);
                        setNotice(
                          result.alreadyImported
                            ? "This message was already imported."
                            : "Message imported as an enquiry. Nothing was sent.",
                        );
                      }
                    })
                  }
                >
                  Import selected message
                </button>
              </section>
            )}
          </div>
        </>
      )}
      {pending && <p role="status">Working…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {imported && (
        <button type="button" onClick={() => openEnquiry(imported)}>
          Open imported enquiry
        </button>
      )}
    </section>
  );
}

function mailDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
      }).format(date);
}
