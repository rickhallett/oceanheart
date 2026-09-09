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
    busy = useRef(false);
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
      <h2>Gmail</h2>
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
      <div className="lp-actions">
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
          <button
            type="button"
            disabled={pending}
            onClick={() => void browse()}
          >
            Browse Gmail messages
          </button>
          {browsed && !items.length && <p>No messages on this page.</p>}
          <ul className="lp-record-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className="lp-gmail-message"
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void run(async () => {
                      const result = await preview(item.id);
                      if (active.current) {
                        setSelected(result);
                        setImported(undefined);
                        setNotice("");
                      }
                    })
                  }
                >
                  {item.subject || `Message ${item.id}`}
                </button>
                {item.from && <p>{item.from}</p>}
                {item.date && <p className="lp-muted">{item.date}</p>}
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
          {selected && (
            <section className="lp-gmail-preview">
              <h3>{selected.subject || "(No subject)"}</h3>
              <p>
                {selected.from} · {selected.date}
              </p>
              <p className="lp-enquiry-message">
                {selected.text ||
                  selected.snippet ||
                  "No readable text content."}
              </p>
              {selected.bodyTruncated && (
                <p className="lp-muted">
                  Message text is truncated. Check Gmail for the full original.
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
