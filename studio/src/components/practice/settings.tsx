"use client";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  practiceApi,
  readableError,
  hasErrorCode,
  type PracticeSettings,
  type SettingsInput,
  type TenantId,
  type WeeklyAvailability,
} from "./api";

const DAYS: [keyof WeeklyAvailability, string][] = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function minutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}
export function PracticeSettings({
  tenantId,
  canWrite,
  timeZone,
}: {
  tenantId: TenantId;
  canWrite: boolean;
  timeZone?: string;
}) {
  const settings = useQuery(practiceApi.settings, { tenantId });
  const update = useMutation(practiceApi.updateSettings);
  const [notice, setNotice] = useState("");
  return (
    <section className="lp-settings">
      <div className="lp-section-heading">
        <h2>Settings</h2>
        {!canWrite && <span className="lp-muted">View-only access</span>}
      </div>
      {!settings ? (
        <p role="status">Loading settings…</p>
      ) : (
        <>
          <SettingsForm
            key={`${canWrite}:${settings.revision}`}
            initial={settings}
            canWrite={canWrite}
            timeZone={timeZone}
            save={async (input, expectedRevision) =>
              update({ ...input, tenantId, expectedRevision })
            }
            changed={() => {
              setNotice("Settings saved.");
            }}
          />
          <p role="status" className="lp-notice">
            {notice}
          </p>
        </>
      )}
    </section>
  );
}
function SettingsForm({
  initial,
  canWrite,
  timeZone,
  save,
  changed,
}: {
  initial: PracticeSettings;
  canWrite: boolean;
  timeZone?: string;
  save: (input: SettingsInput, expectedRevision: number) => Promise<unknown>;
  changed: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [tagline, setTagline] = useState(initial.tagline ?? "");
  const [email, setEmail] = useState(initial.contactEmail ?? "");
  const [phone, setPhone] = useState(initial.contactPhone ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [availability, setAvailability] = useState<WeeklyAvailability>(() =>
    structuredClone(initial.availability),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const busy = useRef(false);
  function reset() {
    setName(initial.name);
    setTagline(initial.tagline ?? "");
    setEmail(initial.contactEmail ?? "");
    setPhone(initial.contactPhone ?? "");
    setAddress(initial.address ?? "");
    setAvailability(structuredClone(initial.availability));
    setError("");
    setConflict(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || conflict || !canWrite) return;
    const cleaned = name.trim();
    if (!cleaned) {
      setError("Enter a practice name.");
      return;
    }
    const week: WeeklyAvailability = { ...availability };
    for (const [day, label] of DAYS) {
      const entry = availability[day];
      if (!entry) {
        week[day] = null;
        continue;
      }
      if (
        !TIME.test(entry.open) ||
        !TIME.test(entry.close) ||
        minutes(entry.close) <= minutes(entry.open)
      ) {
        setError(
          `Set ${label} to closed or give it an opening time before its closing time.`,
        );
        return;
      }
      week[day] = { open: entry.open, close: entry.close };
    }
    const input: SettingsInput = {
      name: cleaned,
      availability: week,
      ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
      ...(email.trim() ? { contactEmail: email.trim() } : {}),
      ...(phone.trim() ? { contactPhone: phone.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
    };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await save(input, initial.revision);
      changed();
    } catch (cause) {
      setError(readableError(cause));
      setConflict(hasErrorCode(cause, "REVISION_CONFLICT"));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form className="lp-record-form lp-settings-form" onSubmit={submit}>
      <h3>Practice details</h3>
      <fieldset disabled={pending || !canWrite}>
        <label htmlFor="settings-name">Practice name</label>
        <input
          id="settings-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          autoComplete="organization"
          required
        />
        <label htmlFor="settings-tagline">Tagline (optional)</label>
        <input
          id="settings-tagline"
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
          maxLength={200}
          placeholder="A short line about your practice"
        />
        <div className="lp-field-pair">
          <div>
            <label htmlFor="settings-email">Contact email (optional)</label>
            <input
              id="settings-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              maxLength={254}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="settings-phone">Contact phone (optional)</label>
            <input
              id="settings-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              maxLength={40}
              autoComplete="tel"
            />
          </div>
        </div>
        <label htmlFor="settings-address">Address (optional)</label>
        <input
          id="settings-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          maxLength={500}
          placeholder="Practice address"
        />
        <h3 className="lp-settings-sub">Default weekly availability</h3>
        <p className="lp-muted lp-availability-note">
          Defaults for future public scheduling — existing bookings are
          unchanged. Times are in the practice time zone
          {timeZone ? ` (${timeZone})` : ""}.
        </p>
        {DAYS.map(([day, label]) => (
          <div className="lp-day-row" key={day}>
            <input
              type="checkbox"
              id={`day-${day}`}
              checked={availability[day] !== null}
              onChange={() =>
                setAvailability((previous) => ({
                  ...previous,
                  [day]: previous[day]
                    ? null
                    : { open: "09:00", close: "17:00" },
                }))
              }
              disabled={pending || !canWrite}
            />
            <label htmlFor={`day-${day}`}>{label}</label>
            <input
              type="time"
              aria-label={`${label} opening time`}
              value={availability[day]?.open ?? ""}
              onChange={(event) =>
                setAvailability((previous) => ({
                  ...previous,
                  [day]: { open: event.target.value, close: previous[day]?.close ?? "" },
                }))
              }
              disabled={pending || !canWrite || !availability[day]}
            />
            <span className="lp-muted">to</span>
            <input
              type="time"
              aria-label={`${label} closing time`}
              value={availability[day]?.close ?? ""}
              onChange={(event) =>
                setAvailability((previous) => ({
                  ...previous,
                  [day]: { open: previous[day]?.open ?? "", close: event.target.value },
                }))
              }
              disabled={pending || !canWrite || !availability[day]}
            />
          </div>
        ))}
        {canWrite && (
          <div className="lp-actions">
            <button
              className="lp-button"
              type="submit"
              disabled={conflict || pending}
            >
              {pending ? "Saving…" : "Save settings"}
            </button>
            <button type="button" onClick={reset} disabled={pending}>
              Discard changes
            </button>
          </div>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {conflict && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload practice
        </button>
      )}
    </form>
  );
}