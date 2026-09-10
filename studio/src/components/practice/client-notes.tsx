"use client";

import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { practiceApi, readableError, type Client, type ClientNotesValue, type TenantId } from "./api";

class NotesBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert">
      <p>Private notes could not be loaded. Check your connection and practice access.</p>
      <button type="button" onClick={() => this.setState({ failed: false })}>Retry notes</button>
    </div> : this.props.children;
  }
}

export function ClientNotes({ tenantId, client }: { tenantId: TenantId; client: Client }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const id = useId();
  return <div className="lp-client-notes">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => { setOpened(true); setOpen(!open); }}>
      {open ? "Hide private notes" : "View private notes"}
    </button>
    {opened && <section hidden={!open} id={id} aria-label={`Private notes for ${client.name}`}>
      <NotesBoundary key={`${tenantId}:${client._id}`}>
        <LoadNotes key={`${tenantId}:${client._id}`} tenantId={tenantId} clientId={client._id} />
      </NotesBoundary>
    </section>}
  </div>;
}

function LoadNotes({ tenantId, clientId }: { tenantId: TenantId; clientId: Client["_id"] }) {
  const notes = useQuery(practiceApi.clientNotes, { tenantId, clientId });
  const save = useMutation(practiceApi.saveClientNotes);
  return notes ? <NotesEditor notes={notes} save={(text, expectedRevision) => save({ tenantId, clientId, text, expectedRevision })} />
    : <p role="status">Loading private notes…</p>;
}

export function NotesEditor({ notes, save }: { notes: ClientNotesValue; save: (text: string, expectedRevision: number) => Promise<ClientNotesValue> }) {
  const [edit, setEdit] = useState({ baseline: notes, text: notes.text });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const id = useId();
  const dirty = edit.text !== edit.baseline.text;
  const newer = notes.revision > edit.baseline.revision;
  const stale = newer || conflict;
  // Clean forms follow remote edits. Dirty drafts wait for explicit recovery.
  // Ignore subscription echoes older than a successful mutation result.
  useEffect(() => {
    if (newer && !dirty && !pending && !conflict) {
      setEdit({ baseline: notes, text: notes.text });
      setNotice("");
    }
  }, [notes, newer, dirty, pending, conflict]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || stale || !dirty) return;
    busy.current = true; setPending(true); setError(""); setNotice("");
    try {
      const saved = await save(edit.text, edit.baseline.revision);
      setEdit({ baseline: saved, text: saved.text });
      setConflict(false); setNotice(saved.text ? "Private notes saved." : "Private notes cleared.");
    } catch (cause) {
      setError(readableError(cause));
      setConflict(String(cause).includes("REVISION_CONFLICT"));
    } finally { busy.current = false; setPending(false); }
  }
  return <form className="lp-notes-form" onSubmit={submit}>
    <label htmlFor={id}>Private notes</label>
    <p className="lp-muted" id={`${id}-hint`}>Visible only to the practice owner. Up to 4,000 characters.</p>
    <textarea id={id} aria-describedby={`${id}-hint`} value={edit.text} maxLength={4000} rows={6} disabled={pending}
      onChange={event => { setEdit({ ...edit, text: event.target.value }); setNotice(""); }} />
    <div className="lp-actions">
      <button type="submit" disabled={pending || stale || !dirty}>{pending ? "Saving…" : "Save notes"}</button>
      {stale && <button type="button" disabled={pending || !newer} onClick={() => {
        setEdit({ baseline: notes, text: notes.text }); setConflict(false); setError(""); setNotice("Latest notes loaded.");
      }}>Use latest notes</button>}
    </div>
    {stale && <p role="alert">Notes changed elsewhere. Your draft is kept. Use latest notes to replace it with the saved version.</p>}
    {error && <p role="alert">{error}</p>}
    <p role="status">{notice || (dirty ? "Unsaved changes" : "")}</p>
  </form>;
}
