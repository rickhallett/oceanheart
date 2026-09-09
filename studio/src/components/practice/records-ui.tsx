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
export type PracticeSection = "tasks" | "services" | "clients";
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
          ...(canWrite ? ["clients"] : []),
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
  const request = useRef<{ signature: string; key: string } | null>(null);
  const busy = useRef(false);
  async function save(input: T) {
    if (busy.current) return;
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
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, error, setError, save };
}
function FormFrame({
  title,
  pending,
  error,
  cancel,
  submit,
  children,
}: {
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
          <button className="lp-button" type="submit">
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function ServiceForm({
  create,
  done,
  cancel,
}: {
  create: (input: ServiceInput, requestKey: string) => Promise<unknown>;
  done: () => void;
  cancel: () => void;
}) {
  const { pending, error, setError, save } = useCreate(create, done);
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
      title="New service"
      pending={pending}
      error={error}
      cancel={cancel}
      submit={submit}
    >
      <label htmlFor="service-name">Service name</label>
      <input id="service-name" name="name" maxLength={100} required autoFocus />
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
            defaultValue="60"
          />
        </div>
        <div>
          <label htmlFor="service-price">Price (£)</label>
          <input
            id="service-price"
            name="price"
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
}: {
  create: (input: ClientInput, requestKey: string) => Promise<unknown>;
  done: () => void;
  cancel: () => void;
}) {
  const { pending, error, setError, save } = useCreate(create, done);
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
      title="New client"
      pending={pending}
      error={error}
      cancel={cancel}
      submit={submit}
    >
      <label htmlFor="client-name">Client name</label>
      <input
        id="client-name"
        name="name"
        maxLength={100}
        required
        autoFocus
        autoComplete="name"
      />
      <label htmlFor="client-email">Email (optional)</label>
      <input
        id="client-email"
        name="email"
        type="email"
        maxLength={254}
        autoComplete="email"
      />
      <label htmlFor="client-phone">Phone (optional)</label>
      <input
        id="client-phone"
        name="phone"
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
export function ServicesPanel({
  items,
  status,
  canWrite,
  create,
  loadMore,
}: {
  items: Service[];
  status: PageStatus;
  canWrite: boolean;
  create: (input: ServiceInput, requestKey: string) => Promise<unknown>;
  loadMore: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  function close() {
    setAdding(false);
    requestAnimationFrame(() => opener.current?.focus());
  }
  return (
    <section className="lp-records">
      <div className="lp-section-heading">
        <h2>Services</h2>
        {canWrite ? (
          <button
            ref={opener}
            type="button"
            onClick={() => {
              setAdding(true);
              setNotice("");
            }}
            disabled={adding}
          >
            Add service
          </button>
        ) : (
          <span className="lp-muted">View-only access</span>
        )}
      </div>
      {adding && canWrite && (
        <ServiceForm
          create={create}
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
          <h3>No services yet</h3>
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
}: {
  items: Client[];
  status: PageStatus;
  create: (input: ClientInput, requestKey: string) => Promise<unknown>;
  loadMore: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  function close() {
    setAdding(false);
    requestAnimationFrame(() => opener.current?.focus());
  }
  return (
    <section className="lp-records">
      <div className="lp-section-heading">
        <h2>Clients</h2>
        <button
          ref={opener}
          type="button"
          onClick={() => {
            setAdding(true);
            setNotice("");
          }}
          disabled={adding}
        >
          Add client
        </button>
      </div>
      {adding && (
        <ClientForm
          create={create}
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
          <h3>No clients yet</h3>
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
          </li>
        ))}
      </ul>
      <More status={status} loadMore={loadMore} noun="clients" />
    </section>
  );
}
