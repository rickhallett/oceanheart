"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  readableError,
  type Client,
  type ClientInput,
  type Service,
  type ServiceInput,
} from "./api";
import { formatPrice, poundsToMinor } from "./money";
export type PageStatus =
  "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
export type PracticeSection =
  "tasks" | "services" | "clients" | "bookings" | "enquiries" | "gmail";
export function PracticeNavigation({
  section,
  canWrite,
  select,
}: {
  section: PracticeSection;
  canWrite: boolean;
  select: (section: PracticeSection) => void;
}) {
  return (
    <nav aria-label="Practice sections" className="lp-section-nav">
      {(
        [
          "tasks",
          "services",
          ...(canWrite ? ["clients", "bookings", "enquiries", "gmail"] : []),
        ] as PracticeSection[]
      ).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === section}
          onClick={() => select(item)}
        >
          {item[0].toUpperCase() + item.slice(1)}
        </button>
      ))}
    </nav>
  );
}
function useCreate<T>(
  create: (input: T, requestKey: string) => Promise<unknown>,
  done: () => void,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const request = useRef<{ signature: string; key: string } | null>(null);
  const busy = useRef(false);
  async function save(input: T) {
    if (busy.current || conflict) return;
    const signature = JSON.stringify(input);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await create(input, request.current.key);
      request.current = null;
      done();
    } catch (cause) {
      setError(readableError(cause));
      setConflict(String(cause).includes("REVISION_CONFLICT"));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, error, setError, conflict, save };
}
function FormFrame({
  title,
  pending,
  error,
  cancel,
  submit,
  children,
  conflict = false,
}: {
  conflict?: boolean;
  title: string;
  pending: boolean;
  error: string;
  cancel: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form className="lp-record-form" onSubmit={submit}>
      <h3>{title}</h3>
      <fieldset disabled={pending}>
        {children}
        <div className="lp-actions">
          <button className="lp-button" type="submit" disabled={conflict}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
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
function ServiceForm({
  create,
  done,
  cancel,
  initial,
}: {
  create: (input: ServiceInput, requestKey: string) => Promise<unknown>;
  initial?: Service;
  done: () => void;
  cancel: () => void;
}) {
  const { pending, error, setError, conflict, save } = useCreate(create, done);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name")).trim();
    const description = String(values.get("description")).trim();
    const durationMinutes = Number(values.get("duration"));
    if (
      !name ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440
    ) {
      setError(
        "Enter a name and a whole-number duration from 1 to 1,440 minutes.",
      );
      return;
    }
    let priceMinor: number;
    try {
      priceMinor = poundsToMinor(String(values.get("price")));
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }
    void save({
      name,
      durationMinutes,
      priceMinor,
      currency: "GBP",
      ...(description ? { description } : {}),
    });
  }
  return (
    <FormFrame
      title={initial ? "Edit service" : "New service"}
      conflict={conflict}
      pending={pending}
      error={error}
      cancel={cancel}
      submit={submit}
    >
      <label htmlFor="service-name">Service name</label>
      <input
        id="service-name"
        name="name"
        defaultValue={initial?.name}
        maxLength={100}
        required
        autoFocus
      />
      <div className="lp-field-pair">
        <div>
          <label htmlFor="service-duration">Duration (minutes)</label>
          <input
            id="service-duration"
            name="duration"
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            defaultValue={initial?.durationMinutes ?? 60}
          />
        </div>
        <div>
          <label htmlFor="service-price">Price (£)</label>
          <input
            id="service-price"
            name="price"
            defaultValue={
              initial ? (initial.priceMinor / 100).toFixed(2) : undefined
            }
            inputMode="decimal"
            maxLength={12}
            placeholder="0.00"
            required
          />
        </div>
      </div>
      <label htmlFor="service-description">Description (optional)</label>
      <textarea
        id="service-description"
        name="description"
        defaultValue={initial?.description}
        maxLength={2000}
        rows={3}
      />
    </FormFrame>
  );
}
function ClientForm({
  create,
  done,
  cancel,
  initial,
}: {
  create: (input: ClientInput, requestKey: string) => Promise<unknown>;
  initial?: Client;
  done: () => void;
  cancel: () => void;
}) {
  const { pending, error, setError, conflict, save } = useCreate(create, done);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name")).trim(),
      email = String(values.get("email")).trim(),
      phone = String(values.get("phone")).trim();
    if (!name) {
      setError("Enter a client name.");
      return;
    }
    void save({
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    });
  }
  return (
    <FormFrame
      title={initial ? "Edit client" : "New client"}
      conflict={conflict}
      pending={pending}
      error={error}
      cancel={cancel}
      submit={submit}
    >
      <label htmlFor="client-name">Client name</label>
      <input
        id="client-name"
        name="name"
        defaultValue={initial?.name}
        maxLength={100}
        required
        autoFocus
        autoComplete="name"
      />
      <label htmlFor="client-email">Email (optional)</label>
      <input
        id="client-email"
        name="email"
        defaultValue={initial?.email}
        type="email"
        maxLength={254}
        autoComplete="email"
      />
      <label htmlFor="client-phone">Phone (optional)</label>
      <input
        id="client-phone"
        name="phone"
        defaultValue={initial?.phone}
        type="tel"
        maxLength={40}
        autoComplete="tel"
      />
    </FormFrame>
  );
}
function More({
  status,
  loadMore,
  noun,
}: {
  status: PageStatus;
  loadMore: () => void;
  noun: string;
}) {
  if (status === "LoadingFirstPage")
    return <p role="status">Loading {noun}…</p>;
  if (status === "Exhausted") return null;
  return (
    <button
      type="button"
      className="lp-load-more"
      onClick={loadMore}
      disabled={status !== "CanLoadMore"}
    >
      {status === "LoadingMore" ? "Loading…" : `Load more ${noun}`}
    </button>
  );
}
export function RecordFilter({
  archived,
  change,
  noun,
}: {
  archived: boolean;
  change: (archived: boolean) => void;
  noun: string;
}) {
  return (
    <div
      className="lp-record-filter"
      role="group"
      aria-label={`${noun} status`}
    >
      <button
        type="button"
        aria-pressed={!archived}
        onClick={() => change(false)}
      >
        Active
      </button>
      <button
        type="button"
        aria-pressed={archived}
        onClick={() => change(true)}
      >
        Archived
      </button>
    </div>
  );
}
export function ClientSearch({
  search,
  change,
}: {
  search: string;
  change: (search: string) => void;
}) {
  const [value, setValue] = useState(search),
    [error, setError] = useState("");
  return (
    <form
      className="lp-record-search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        if (query.split(/\s+/).filter(Boolean).length > 16) {
          setError("Use up to 16 search terms.");
          return;
        }
        setError("");
        change(query);
      }}
    >
      <label htmlFor="client-search">Search clients by name or email</label>
      <div className="lp-inline">
        <input
          id="client-search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={100}
        />
        <button type="submit">Search</button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setError("");
              change("");
            }}
          >
            Clear
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function RecordActions({
  archived,
  edit,
  archive,
}: {
  archived: boolean;
  edit: () => void;
  archive: (archived: boolean) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false);
  const [conflict, setConflict] = useState(false);
  async function change() {
    if (busy.current || conflict) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await archive(!archived);
    } catch (cause) {
      setError(readableError(cause));
      setConflict(String(cause).includes("REVISION_CONFLICT"));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <div className="lp-actions">
        <button type="button" disabled={pending || conflict} onClick={edit}>
          Edit
        </button>
        <button
          type="button"
          disabled={pending || conflict}
          onClick={() => void change()}
        >
          {pending ? "Saving…" : archived ? "Restore" : "Archive"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {error && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload practice
        </button>
      )}
    </>
  );
}
export function ServicesPanel({
  items,
  status,
  canWrite,
  create,
  loadMore,
  archived = false,
  update,
  archive,
}: {
  items: Service[];
  status: PageStatus;
  canWrite: boolean;
  create: (input: ServiceInput, requestKey: string) => Promise<unknown>;
  loadMore: () => void;
  archived?: boolean;
  update?: (record: Service, input: ServiceInput) => Promise<unknown>;
  archive?: (record: Service, archived: boolean) => Promise<unknown>;
}) {
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Service>(),
    [notice, setNotice] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  function close() {
    setAdding(false);
    setEditing(undefined);
    requestAnimationFrame(() => opener.current?.focus());
  }
  return (
    <section className="lp-records">
      <div className="lp-section-heading">
        <h2>Services</h2>
        {canWrite && !archived ? (
          <button
            ref={opener}
            type="button"
            disabled={adding || !!editing}
            onClick={() => {
              setAdding(true);
              setNotice("");
            }}
          >
            Add service
          </button>
        ) : !canWrite ? (
          <span className="lp-muted">View-only access</span>
        ) : null}
      </div>
      {(adding || editing) && canWrite && (
        <ServiceForm
          key={editing?._id ?? "new"}
          initial={editing}
          create={(input, key) =>
            editing ? update!(editing, input) : create(input, key)
          }
          cancel={close}
          done={() => {
            setNotice("Service saved.");
            close();
          }}
        />
      )}
      <p role="status" className="lp-notice">
        {notice}
      </p>
      {status !== "LoadingFirstPage" && items.length === 0 && (
        <div className="lp-empty">
          <h3>{archived ? "No archived services" : "No services yet"}</h3>
        </div>
      )}
      <ul className="lp-record-list">
        {items.map((service) => (
          <li key={service._id} data-service-id={service._id}>
            <h3>{service.name}</h3>
            <dl>
              <div>
                <dt>Duration</dt>
                <dd>{service.durationMinutes} minutes</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{formatPrice(service.priceMinor)}</dd>
              </div>
            </dl>
            {service.description && (
              <p className="lp-description">{service.description}</p>
            )}
            {canWrite && update && archive && (
              <RecordActions
                archived={!service.active}
                edit={() => {
                  setAdding(false);
                  setEditing(service);
                  setNotice("");
                }}
                archive={(value) => archive(service, value)}
              />
            )}
          </li>
        ))}
      </ul>
      <More status={status} loadMore={loadMore} noun="services" />
    </section>
  );
}
export function ClientsPanel({
  items,
  status,
  create,
  loadMore,
  archived = false,
  search = "",
  update,
  archive,
}: {
  items: Client[];
  status: PageStatus;
  create: (input: ClientInput, requestKey: string) => Promise<unknown>;
  loadMore: () => void;
  archived?: boolean;
  search?: string;
  update?: (record: Client, input: ClientInput) => Promise<unknown>;
  archive?: (record: Client, archived: boolean) => Promise<unknown>;
}) {
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Client>(),
    [notice, setNotice] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  function close() {
    setAdding(false);
    setEditing(undefined);
    requestAnimationFrame(() => opener.current?.focus());
  }
  return (
    <section className="lp-records">
      <div className="lp-section-heading">
        <h2>Clients</h2>
        {!archived && (
          <button
            ref={opener}
            type="button"
            disabled={adding || !!editing}
            onClick={() => {
              setAdding(true);
              setNotice("");
            }}
          >
            Add client
          </button>
        )}
      </div>
      {(adding || editing) && (
        <ClientForm
          key={editing?._id ?? "new"}
          initial={editing}
          create={(input, key) =>
            editing ? update!(editing, input) : create(input, key)
          }
          cancel={close}
          done={() => {
            setNotice("Client saved.");
            close();
          }}
        />
      )}
      <p role="status" className="lp-notice">
        {notice}
      </p>
      {status !== "LoadingFirstPage" && items.length === 0 && (
        <div className="lp-empty">
          <h3>
            {search
              ? "No clients match your search"
              : archived
                ? "No archived clients"
                : "No clients yet"}
          </h3>
        </div>
      )}
      <ul className="lp-record-list">
        {items.map((client) => (
          <li key={client._id} data-client-id={client._id}>
            <h3>{client.name}</h3>
            {(client.email || client.phone) && (
              <dl className="lp-contact-details">
                {client.email && (
                  <div>
                    <dt>Email</dt>
                    <dd>{client.email}</dd>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <dt>Phone</dt>
                    <dd>{client.phone}</dd>
                  </div>
                )}
              </dl>
            )}
            {update && archive && (
              <RecordActions
                archived={client.archived}
                edit={() => {
                  setAdding(false);
                  setEditing(client);
                  setNotice("");
                }}
                archive={(value) => archive(client, value)}
              />
            )}
          </li>
        ))}
      </ul>
      <More status={status} loadMore={loadMore} noun="clients" />
    </section>
  );
}
