'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowIcon } from '../components/arrow-icon';

export function InterestForm() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState('');
  function openDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const note = String(data.get('note') ?? '').trim();
    const body = `Hi Rick,\n\nI’d like to register my interest in your local events and classes.\n\nName: ${name}\nEmail: ${email}${note ? `\n\nAvailability and interests:\n${note}` : ''}\n\nBest wishes,\n${name}`;
    const href = `mailto:rick@oceanheart.ai?subject=${encodeURIComponent('Interest in local events & classes')}&body=${encodeURIComponent(body)}`;
    setDraft(href);
    window.location.href = href;
  }
  return <>
    <div className="booking-actions"><button ref={trigger} className="booking-link" type="button" onClick={() => { setDraft(''); dialog.current?.showModal(); }}>Register your interest <ArrowIcon /></button></div>
    <dialog className="interest-dialog" ref={dialog} aria-labelledby="interest-title" onClose={() => trigger.current?.focus()}>
      <button className="interest-close" type="button" aria-label="Close registration form" onClick={() => dialog.current?.close()}>Close ×</button>
      <h2 id="interest-title">Register your interest</h2>
      <p>Leave your details and open an email draft to Rick.</p>
      <form onSubmit={openDraft}>
        <label htmlFor="interest-name">Name</label>
        <input id="interest-name" name="name" autoComplete="name" required maxLength={120} pattern=".*\S.*" />
        <label htmlFor="interest-email">Email</label>
        <input id="interest-email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <label htmlFor="interest-note">Anything you’d like to add? <span>(optional)</span></label>
        <p className="interest-hint" id="interest-note-hint">You’re welcome to share your availability, preferred town, or the kinds of practice you’re looking for.</p>
        <textarea id="interest-note" name="note" rows={4} maxLength={1500} aria-describedby="interest-note-hint" />
        <p className="interest-hint">This opens your email app. You can review the draft before sending it.</p>
        <div className="booking-actions"><button type="submit" className="booking-link">Open email draft <ArrowIcon /></button></div>
      </form>
      {draft && <p className="interest-status" role="status">Your email app should open with a draft. Nothing has been sent by this page. <a href={draft}>Open the draft again</a>, or email <a href="mailto:rick@oceanheart.ai">rick@oceanheart.ai</a>.</p>}
    </dialog>
  </>;
}
