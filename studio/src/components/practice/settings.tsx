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
type Draft = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  availability: WeeklyAvailability;
};
type Baseline = {
  revision: number;
  timeZone: string | null;
  draft: Draft;
};
function draftFromSettings(settings: PracticeSettings): Draft {
  return {
    name: settings.name,
    tagline: settings.tagline ?? "",
    email: settings.contactEmail ?? "",
    phone: settings.contactPhone ?? "",
    address: settings.address ?? "",
    availability: structuredClone(settings.availability),
  };
}
function baselineFromSettings(settings: PracticeSettings): Baseline {
  return {
    revision: settings.revision,
    timeZone: settings.timeZone ?? null,
    draft: draftFromSettings(settings),
  };
}
// Key order is not significant: the backend may persist objects in storage
// order, so draft equality must compare structurally.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(
          Object.keys(val)
            .sort()
            .map((k) => [k, (val as Record<string, unknown>)[k]]),
        )
      : val,
  );
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
            key={`${tenantId}:${canWrite}`}
            live={settings}
            canWrite={canWrite}
            timeZone={timeZone}
            save={async (input, expectedRevision, expectedTimeZone) =>
              update({ ...input, tenantId, expectedRevision, expectedTimeZone })
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
  live,
  canWrite,
  timeZone,
  save,
  changed,
}: {
  live: PracticeSettings;
  canWrite: boolean;
  timeZone?: string;
  save: (
    input: SettingsInput,
    expectedRevision: number,
    expectedTimeZone: string | null,
  ) => Promise<number>;
  changed: () => void;
}) {
  const [baseline, setBaseline] = useState(() => baselineFromSettings(live));
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(live));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const busy = useRef(false);
  // Reconcile reactive server updates without ever overwriting an unsaved
  // draft: a clean form adopts the latest snapshot, a dirty form keeps its
  // edits and surfaces an explicit conflict.
  const [prevLive, setPrevLive] = useState(live);
  if (prevLive !== live) {
    setPrevLive(live);
    const next = baselineFromSettings(live);
    const zoneSame = next.timeZone === baseline.timeZone;
    const clean = canonical(draft) === canonical(baseline.draft);
    const matchesLive = canonical(draft) === canonical(next.draft);
    if (!conflict && ((zoneSame && (clean || matchesLive)) || (!zoneSame && clean))) {
      setBaseline(next);
      setDraft(next.draft);
    } else if (!conflict && !zoneSame) {
      setConflict(true);
      setError(
        "The practice time zone changed since you opened these settings. Your edits are kept. Load the latest settings before saving.",
      );
    } else if (!conflict) {
      setConflict(true);
      setError(
        "These settings changed elsewhere since you opened them. Your edits are kept. Load the latest settings to review them before saving.",
      );
    }
  }
  function loadLatest() {
    const next = baselineFromSettings(live);
    setBaseline(next);
    setDraft(next.draft);
    setError("");
    setConflict(false);
  }
  function reset() {
    setDraft({
      ...baseline.draft,
      availability: structuredClone(baseline.draft.availability),
    });
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || conflict || !canWrite) return;
    const cleaned = draft.name.trim();
    if (!cleaned) {
      setError("Enter a practice name.");
      return;
    }
    const week: WeeklyAvailability = { ...draft.availability };
    for (const [day, label] of DAYS) {
      const entry = draft.availability[day];
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
    const saved: Draft = {
      name: cleaned,
      tagline: draft.tagline.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
      availability: week,
    };
    const input: SettingsInput = {
      name: saved.name,
      availability: saved.availability,
      ...(saved.tagline ? { tagline: saved.tagline } : {}),
      ...(saved.email ? { contactEmail: saved.email } : {}),
      ...(saved.phone ? { contactPhone: saved.phone } : {}),
      ...(saved.address ? { address: saved.address } : {}),
    };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const revision = await save(input, baseline.revision, baseline.timeZone);
      // A successful save establishes the new baseline immediately, so the
      // reactive echo of our own write never reads as a remote conflict.
      setBaseline({ revision, timeZone: baseline.timeZone, draft: saved });
      setDraft(saved);
      setConflict(false);
      changed();
    } catch (cause) {
      if (hasErrorCode(cause, "TIME_ZONE_CHANGED")) {
        setConflict(true);
        setError(
          "The practice time zone changed since you opened these settings. Your edits are kept. Load the latest settings before saving.",
        );
      } else {
        setConflict(hasErrorCode(cause, "REVISION_CONFLICT"));
        setError(
          hasErrorCode(cause, "REVISION_CONFLICT")
            ? "These settings changed elsewhere since you opened them. Your edits are kept. Load the latest settings to review them before saving."
            : readableError(cause),
        );
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function setDay(
    day: keyof WeeklyAvailability,
    entry: WeeklyAvailability[keyof WeeklyAvailability],
  ) {
    setDraft((previous) => ({ ...previous, availability: { ...previous.availability, [day]: entry } }));
  }
  const zone = live.timeZone ?? timeZone;
  return (
    <form className="lp-record-form lp-settings-form" onSubmit={submit}>
      <h3>Practice details</h3>
      <fieldset disabled={pending || !canWrite}>
        <label htmlFor="settings-name">Practice name</label>
        <input
          id="settings-name"
          value={draft.name}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, name: event.target.value }))
          }
          maxLength={100}
          autoComplete="organization"
          required
        />
        <label htmlFor="settings-tagline">Tagline (optional)</label>
        <input
          id="settings-tagline"
          value={draft.tagline}
          onChange={(event) =>
            setDraft((previous) => ({
              ...previous,
              tagline: event.target.value,
            }))
          }
          maxLength={200}
          placeholder="A short line about your practice"
        />
        <div className="lp-field-pair">
          <div>
            <label htmlFor="settings-email">Contact email (optional)</label>
            <input
              id="settings-email"
              value={draft.email}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
              type="email"
              maxLength={254}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="settings-phone">Contact phone (optional)</label>
            <input
              id="settings-phone"
              value={draft.phone}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  phone: event.target.value,
                }))
              }
              type="tel"
              maxLength={40}
              autoComplete="tel"
            />
          </div>
        </div>
        <label htmlFor="settings-address">Address (optional)</label>
        <input
          id="settings-address"
          value={draft.address}
          onChange={(event) =>
            setDraft((previous) => ({
              ...previous,
              address: event.target.value,
            }))
          }
          maxLength={500}
          placeholder="Practice address"
        />
        <h3 className="lp-settings-sub">Default weekly availability</h3>
        <p className="lp-muted lp-availability-note">
          Defaults for future public scheduling — existing bookings are
          unchanged. Times are in the practice time zone
          {zone ? ` (${zone})` : ""}.
        </p>
        {DAYS.map(([day, label]) => (
          <div className="lp-day-row" key={day}>
            <input
              type="checkbox"
              id={`day-${day}`}
              checked={draft.availability[day] !== null}
              onChange={() =>
                setDay(
                  day,
                  draft.availability[day]
                    ? null
                    : { open: "09:00", close: "17:00" },
                )
              }
              disabled={pending || !canWrite}
            />
            <label htmlFor={`day-${day}`}>{label}</label>
            <div className="lp-time-interval">
              <input
                type="time"
                aria-label={`${label} opening time`}
                value={draft.availability[day]?.open ?? ""}
                onChange={(event) =>
                  setDay(day, {
                    open: event.target.value,
                    close: draft.availability[day]?.close ?? "",
                  })
                }
                disabled={pending || !canWrite || !draft.availability[day]}
              />
              <span className="lp-muted">to</span>
              <input
                type="time"
                aria-label={`${label} closing time`}
                value={draft.availability[day]?.close ?? ""}
                onChange={(event) =>
                  setDay(day, {
                    open: draft.availability[day]?.open ?? "",
                    close: event.target.value,
                  })
                }
                disabled={pending || !canWrite || !draft.availability[day]}
              />
            </div>
          </div>
        ))}
        {canWrite && !conflict && (
          <div className="lp-actions">
            <button
              className="lp-button"
              type="submit"
              disabled={pending}
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
        <button type="button" onClick={loadLatest}>
          Load latest settings
        </button>
      )}
    </form>
  );
}
