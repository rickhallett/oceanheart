"use client";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  enquiryApi,
  type Enquiry,
  type EnquiryId,
  type EnquiryInput,
  type Conversion,
} from "./enquiry-api";
import {
  practiceApi,
  readableError,
  hasErrorCode,
  type TenantId,
  type Client,
  type Service,
  type Booking,
} from "./api";
import { BookingTimeInput, PickerMore } from "./bookings";
import {
  resolveBookingTime,
  todayIn,
  displayBookingTime,
} from "./booking-time";
import { formatPrice } from "./money";

export function PracticeEnquiries({
  tenantId,
  timeZone,
  initialId,
}: {
  tenantId: TenantId;
  timeZone?: string;
  initialId?: EnquiryId;
}) {
  const [resolved, setResolved] = useState(false),
    [selected, setSelected] = useState<EnquiryId | undefined>(initialId),
    [adding, setAdding] = useState(false);
  const page = usePaginatedQuery(
    enquiryApi.list,
    { tenantId, resolved },
    { initialNumItems: 20 },
  );
  const create = useMutation(enquiryApi.create);
  if (selected)
    return (
      <EnquiryDetail
        key={selected}
        tenantId={tenantId}
        enquiryId={selected}
        timeZone={timeZone}
        back={() => setSelected(undefined)}
      />
    );
  return (
    <section className="lp-enquiries">
      <h2>Enquiries</h2>
      <p className="lp-muted">
        Manually recorded enquiries. Reply drafts are saved here and are not
        sent.
      </p>
      <div className="lp-actions" role="group" aria-label="Enquiry status">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={resolved === value}
            onClick={() => {
              setResolved(value);
              setAdding(false);
            }}
          >
            {value ? "Resolved" : "Open"}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setAdding(true)} disabled={adding}>
        Record enquiry
      </button>
      {adding && (
        <EnquiryCapture
          create={(input, key) =>
            create({ ...input, tenantId, requestKey: key })
          }
          done={(id) => {
            setAdding(false);
            setSelected(id);
          }}
          cancel={() => setAdding(false)}
        />
      )}
      {page.status === "LoadingFirstPage" ? (
        <p role="status">Loading enquiries…</p>
      ) : page.results.length === 0 ? (
        <p>No {resolved ? "resolved" : "open"} enquiries.</p>
      ) : (
        <ul className="lp-records">
          {page.results.map((item) => (
            <li key={item._id} data-enquiry-id={item._id}>
              <button
                className="lp-enquiry-open"
                type="button"
                onClick={() => setSelected(item._id)}
              >
                {item.subject}
              </button>
              <p>
                {item.name} ·{" "}
                {item.hasDraft ? "Draft saved, not sent" : "No reply draft"}
              </p>
              {item.clientId && (
                <p className="lp-muted">
                  Client linked{item.bookingId ? " · Booking linked" : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {(page.status === "CanLoadMore" || page.status === "LoadingMore") && (
        <PickerMore
          page={{
            items: page.results,
            status: page.status,
            loadMore: () => page.loadMore(20),
          }}
          noun="enquiries"
        />
      )}
    </section>
  );
}
function useCommand() {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const busy = useRef(false);
  return {
    pending,
    error,
    conflict,
    setError,
    async run(work: () => Promise<unknown>, done: () => void) {
      if (busy.current || conflict) return;
      busy.current = true;
      setPending(true);
      setError("");
      try {
        await work();
        done();
      } catch (cause) {
        setError(readableError(cause));
        setConflict(
          hasErrorCode(cause, "REVISION_CONFLICT") ||
            hasErrorCode(cause, "LINK_CONFLICT"),
        );
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
  };
}
function CommandFeedback({
  error,
  conflict,
}: {
  error: string;
  conflict: boolean;
}) {
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {conflict && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload practice
        </button>
      )}
    </>
  );
}
export function EnquiryCapture({
  create,
  done,
  cancel,
}: {
  create: (input: EnquiryInput, key: string) => Promise<EnquiryId>;
  done: (id: EnquiryId) => void;
  cancel: () => void;
}) {
  const command = useCommand(),
    request = useRef<{ signature: string; key: string } | undefined>(undefined);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name")).trim(),
      email = String(values.get("email")).trim(),
      phone = String(values.get("phone")).trim(),
      subject = String(values.get("subject")).trim(),
      message = String(values.get("message")).trim();
    if (!name || !subject || !message) {
      command.setError("Enter a contact name, subject and message.");
      return;
    }
    const input = {
      name,
      subject,
      message,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    };
    const signature = JSON.stringify(input);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    let id: EnquiryId;
    await command.run(
      async () => {
        id = await create(input, request.current!.key);
      },
      () => done(id!),
    );
  }
  return (
    <form className="lp-record-form" onSubmit={submit}>
      <h3>Record enquiry</h3>
      <fieldset disabled={command.pending}>
        <label htmlFor="enquiry-name">Contact name</label>
        <input id="enquiry-name" name="name" required maxLength={100} />
        <label htmlFor="enquiry-email">Email (optional)</label>
        <input id="enquiry-email" name="email" type="email" maxLength={254} />
        <label htmlFor="enquiry-phone">Phone (optional)</label>
        <input id="enquiry-phone" name="phone" maxLength={40} />
        <label htmlFor="enquiry-subject">Subject</label>
        <input id="enquiry-subject" name="subject" required maxLength={150} />
        <label htmlFor="enquiry-message">Message</label>
        <textarea
          id="enquiry-message"
          name="message"
          required
          maxLength={5000}
          rows={5}
        />
        <div className="lp-actions">
          <button type="submit" disabled={command.conflict}>
            {command.pending ? "Saving…" : "Save enquiry"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      <CommandFeedback {...command} />
    </form>
  );
}
function EnquiryDetail({
  tenantId,
  enquiryId,
  timeZone,
  back,
}: {
  tenantId: TenantId;
  enquiryId: EnquiryId;
  timeZone?: string;
  back: () => void;
}) {
  const record = useQuery(enquiryApi.get, { tenantId, enquiryId }),
    save = useMutation(enquiryApi.saveDraft),
    resolve = useMutation(enquiryApi.setResolved),
    convert = useMutation(enquiryApi.convert);
  const [draft, setDraft] = useState<Enquiry>(),
    [conversion, setConversion] = useState<Enquiry>(),
    [notice, setNotice] = useState("");
  const command = useCommand();
  if (!record) return <p role="status">Loading enquiry…</p>;
  return (
    <section className="lp-enquiries" data-enquiry-detail-id={record._id}>
      <button type="button" onClick={back}>
        Back to enquiries
      </button>
      <h2>{record.subject}</h2>
      <p>
        {record.name}
        {record.email ? ` · ${record.email}` : ""}
        {record.phone ? ` · ${record.phone}` : ""}
      </p>
      <p className="lp-enquiry-message">{record.message}</p>
      <p className="lp-muted">
        {record.resolved ? "Resolved" : "Open"} ·{" "}
        {record.source?.kind === "gmail"
          ? `Imported from Gmail (${record.source.mailbox})`
          : "Manually recorded"}
      </p>
      {record.source?.truncated && (
        <p className="lp-muted">
          Imported message text was truncated. Check Gmail for the full
          original.
        </p>
      )}
      <h3>Reply draft — not sent</h3>
      {draft ? (
        <ReplyDraft
          initial={draft.draft}
          save={(text) =>
            save({
              tenantId,
              enquiryId,
              text,
              expectedRevision: draft.revision,
            })
          }
          done={() => {
            setDraft(undefined);
            setNotice("Reply draft saved. Nothing was sent.");
          }}
          cancel={() => setDraft(undefined)}
        />
      ) : (
        <>
          <p className="lp-enquiry-message">
            {record.draft || "No reply draft yet."}
          </p>
          <button
            type="button"
            disabled={!!conversion || command.pending}
            onClick={() => {
              setDraft(record);
              setNotice("");
            }}
          >
            Edit reply draft
          </button>
        </>
      )}
      <h3>Linked records</h3>
      {record.clientId ? (
        <p data-linked-client-id={record.clientId}>
          Client: {record.linkedClient?.name ?? "Linked client"}
          {record.linkedClient?.archived ? " (archived)" : ""}
        </p>
      ) : (
        <p>No client linked.</p>
      )}
      {record.linkedBooking && (
        <p data-linked-booking-id={record.linkedBooking._id}>
          {record.linkedBooking.serviceName ?? "Booking"} ·{" "}
          {displayBookingTime(
            record.linkedBooking.startsAt,
            timeZone ?? record.linkedBooking.timeZone ?? "UTC",
          )}{" "}
          –{" "}
          {displayBookingTime(
            record.linkedBooking.endsAt,
            timeZone ?? record.linkedBooking.timeZone ?? "UTC",
          )}{" "}
          ·{" "}
          {record.linkedBooking.status === "cancelled"
            ? "Cancelled"
            : "Scheduled"}
        </p>
      )}
      {conversion ? (
        <ConversionLoader
          tenantId={tenantId}
          record={conversion}
          timeZone={timeZone}
          convert={(input, key) =>
            convert({
              ...input,
              tenantId,
              enquiryId,
              expectedRevision: conversion.revision,
              requestKey: key,
            })
          }
          done={() => {
            setConversion(undefined);
            setNotice("Records linked. The enquiry status is unchanged.");
          }}
          cancel={() => setConversion(undefined)}
        />
      ) : (
        !record.bookingId && (
          <button
            type="button"
            disabled={!!draft || command.pending}
            onClick={() => {
              setConversion(record);
              setNotice("");
            }}
          >
            {record.clientId ? "Link booking" : "Convert to client / booking"}
          </button>
        )
      )}
      <div className="lp-actions">
        <button
          type="button"
          disabled={
            !!draft || !!conversion || command.pending || command.conflict
          }
          onClick={() =>
            void command.run(
              () =>
                resolve({
                  tenantId,
                  enquiryId,
                  resolved: !record.resolved,
                  expectedRevision: record.revision,
                }),
              () =>
                setNotice(
                  record.resolved ? "Enquiry reopened." : "Enquiry resolved.",
                ),
            )
          }
        >
          {command.pending
            ? "Saving…"
            : record.resolved
              ? "Reopen enquiry"
              : "Resolve enquiry"}
        </button>
      </div>
      <CommandFeedback {...command} />
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
export function ReplyDraft({
  initial,
  save,
  done,
  cancel,
}: {
  initial: string;
  save: (text: string) => Promise<unknown>;
  done: () => void;
  cancel: () => void;
}) {
  const [text, setText] = useState(initial),
    command = useCommand();
  return (
    <form
      className="lp-record-form"
      onSubmit={(event) => {
        event.preventDefault();
        void command.run(() => save(text.trim()), done);
      }}
    >
      <fieldset disabled={command.pending}>
        <label htmlFor="reply-draft">Reply draft (not sent)</label>
        <textarea
          id="reply-draft"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={5000}
          rows={6}
        />
        <p className="lp-muted">
          Saving this draft does not send email or contact the enquirer.
        </p>
        <div className="lp-actions">
          <button type="submit" disabled={command.conflict}>
            {command.pending ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      <CommandFeedback {...command} />
    </form>
  );
}
type PickPage<T> = {
  items: T[];
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: () => void;
};
function ConversionLoader({
  tenantId,
  record,
  timeZone,
  convert,
  done,
  cancel,
}: {
  tenantId: TenantId;
  record: Enquiry;
  timeZone?: string;
  convert: (input: Conversion, key: string) => Promise<unknown>;
  done: () => void;
  cancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const clients = usePaginatedQuery(
      practiceApi.clients,
      { tenantId, archived: false, search },
      { initialNumItems: 20 },
    ),
    services = usePaginatedQuery(
      practiceApi.services,
      { tenantId, archived: false },
      { initialNumItems: 20 },
    );
  return (
    <ConversionForm
      record={record}
      timeZone={timeZone}
      clients={{
        items: clients.results,
        status: clients.status,
        loadMore: () => clients.loadMore(20),
      }}
      services={{
        items: services.results,
        status: services.status,
        loadMore: () => services.loadMore(20),
      }}
      search={search}
      setSearch={setSearch}
      convert={convert}
      done={done}
      cancel={cancel}
      existingBookings={(clientId, choose) => (
        <ExistingBookingPicker
          tenantId={tenantId}
          clientId={clientId}
          timeZone={timeZone!}
          choose={choose}
        />
      )}
    />
  );
}
export function ConversionForm({
  record,
  timeZone,
  clients,
  services,
  search,
  setSearch,
  convert,
  done,
  cancel,
  existingBookings,
}: {
  record: Enquiry;
  timeZone?: string;
  clients: PickPage<Client>;
  services: PickPage<Service>;
  search: string;
  setSearch: (value: string) => void;
  convert: (input: Conversion, key: string) => Promise<unknown>;
  done: () => void;
  cancel: () => void;
  existingBookings: (
    clientId: Client["_id"],
    choose: (id: Booking["_id"] | undefined) => void,
  ) => React.ReactNode;
}) {
  const [mode, setMode] = useState(record.clientId ? "existing" : ""),
    [clientId, setClientId] = useState<string>(record.clientId ?? ""),
    [name, setName] = useState(record.name),
    [email, setEmail] = useState(record.email ?? ""),
    [phone, setPhone] = useState(record.phone ?? ""),
    [query, setQuery] = useState(search),
    [bookingMode, setBookingMode] = useState("none"),
    [bookingId, setBookingId] = useState<Booking["_id"]>(),
    [serviceId, setServiceId] = useState(""),
    [local, setLocal] = useState(timeZone ? `${todayIn(timeZone)}T09:00` : ""),
    [fold, setFold] = useState("");
  const command = useCommand(),
    request = useRef<{ signature: string; key: string } | undefined>(undefined);
  const selectedClient =
    record.clientId ??
    clients.items.find((item) => item._id === clientId && !item.archived)?._id;
  async function submit(event: FormEvent) {
    event.preventDefault();
    let input: Conversion;
    if (mode === "existing" && selectedClient)
      input = { client: { existingId: selectedClient } };
    else if (mode === "new" && name.trim())
      input = {
        client: {
          create: {
            name: name.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          },
        },
      };
    else {
      command.setError("Choose an existing client or enter a new client name.");
      return;
    }
    if (bookingMode === "existing") {
      if (!bookingId) {
        command.setError("Choose a booking for the selected client.");
        return;
      }
      input.booking = { existingId: bookingId };
    }
    if (bookingMode === "new") {
      const service = services.items.find(
        (item) => item._id === serviceId && item.active,
      );
      if (!service || !timeZone) {
        command.setError(
          "Choose an active service and configure the practice time zone in Bookings.",
        );
        return;
      }
      try {
        input.booking = {
          create: {
            serviceId: service._id,
            startsAt: resolveBookingTime(local, timeZone, fold),
          },
        };
      } catch (cause) {
        command.setError((cause as Error).message);
        return;
      }
    }
    const signature = JSON.stringify(input);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    await command.run(() => convert(input, request.current!.key), done);
  }
  function changeClient(value: string) {
    setClientId(value);
    setBookingId(undefined);
  }
  return (
    <form className="lp-record-form" onSubmit={submit}>
      <h3>Link client and optional booking</h3>
      <p className="lp-muted">
        Choose deliberately. Matching email addresses do not merge contacts.
        Conversion does not send a reply or resolve this enquiry.
      </p>
      <fieldset disabled={command.pending}>
        {record.clientId ? (
          <p>
            Keep the already linked client. Existing links cannot be reassigned.
          </p>
        ) : (
          <>
            <label htmlFor="conversion-client-mode">Client choice</label>
            <select
              id="conversion-client-mode"
              value={mode}
              required
              onChange={(event) => {
                setMode(event.target.value);
                changeClient("");
                setBookingMode("none");
              }}
            >
              <option value="">Choose a client action</option>
              <option value="existing">Link existing client</option>
              <option value="new">Create separate client</option>
            </select>
          </>
        )}
        {mode === "existing" && !record.clientId && (
          <>
            <label htmlFor="conversion-search">
              Find client by name or email
            </label>
            <div className="lp-inline">
              <input
                id="conversion-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={100}
              />
              <button
                type="button"
                onClick={() => {
                  if (query.trim().split(/\s+/).filter(Boolean).length > 16) {
                    command.setError("Use up to 16 search terms.");
                    return;
                  }
                  changeClient("");
                  setSearch(query.trim());
                }}
              >
                Find
              </button>
            </div>
            <label htmlFor="conversion-client">Existing client</label>
            <select
              id="conversion-client"
              value={selectedClient ?? ""}
              required
              onChange={(event) => changeClient(event.target.value)}
            >
              <option value="">Choose an active client</option>
              {clients.items.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                  {item.email ? ` · ${item.email}` : ""}
                </option>
              ))}
            </select>
            <PickerMore page={clients} noun="clients" />
          </>
        )}
        {mode === "new" && (
          <>
            <label htmlFor="conversion-name">New client name</label>
            <input
              id="conversion-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
            <label htmlFor="conversion-email">
              New client email (optional)
            </label>
            <input
              id="conversion-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
            />
            <label htmlFor="conversion-phone">
              New client phone (optional)
            </label>
            <input
              id="conversion-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
            />
          </>
        )}
        <label htmlFor="conversion-booking-mode">Booking choice</label>
        <select
          id="conversion-booking-mode"
          value={bookingMode}
          onChange={(event) => {
            setBookingMode(event.target.value);
            setBookingId(undefined);
          }}
        >
          <option value="none">No new booking link</option>
          <option value="new" disabled={!timeZone}>
            Create booking
          </option>
          <option
            value="existing"
            disabled={!timeZone || !selectedClient || mode !== "existing"}
          >
            Link existing booking
          </option>
        </select>
        {!timeZone && (
          <p className="lp-muted">
            Save the practice time zone in Bookings to add a booking link.
          </p>
        )}
        {bookingMode === "new" && timeZone && (
          <>
            <label htmlFor="conversion-service">Booking service</label>
            <select
              id="conversion-service"
              value={serviceId}
              required
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">Choose an active service</option>
              {services.items.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} · {item.durationMinutes} min ·{" "}
                  {formatPrice(item.priceMinor)}
                </option>
              ))}
            </select>
            <PickerMore page={services} noun="services" />
            <BookingTimeInput
              value={local}
              change={setLocal}
              timeZone={timeZone}
              fold={fold}
              setFold={setFold}
            />
          </>
        )}
        {bookingMode === "existing" &&
          selectedClient &&
          existingBookings(selectedClient, setBookingId)}
        <div className="lp-actions">
          <button type="submit" disabled={command.conflict}>
            {command.pending ? "Linking…" : "Save links"}
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      <CommandFeedback {...command} />
    </form>
  );
}
function ExistingBookingPicker({
  tenantId,
  clientId,
  timeZone,
  choose,
}: {
  tenantId: TenantId;
  clientId: Client["_id"];
  timeZone: string;
  choose: (id: Booking["_id"] | undefined) => void;
}) {
  const [local, setLocal] = useState(`${todayIn(timeZone)}T09:00`),
    [fold, setFold] = useState(""),
    [selected, setSelected] = useState("");
  let from: number | undefined,
    error = "";
  try {
    from = resolveBookingTime(local, timeZone, fold);
  } catch (cause) {
    error = (cause as Error).message;
  }
  const result = useQuery(
      practiceApi.bookings,
      from === undefined ? "skip" : { tenantId, from, to: from + 3600000 },
    ),
    items =
      result?.items.filter(
        (item) =>
          item.clientId === clientId &&
          item.status === "scheduled" &&
          !item.legacy,
      ) ?? [];
  function reset(value: string) {
    setLocal(value);
    setSelected("");
    choose(undefined);
  }
  return (
    <div>
      <p>Find this client's bookings overlapping a one-hour window.</p>
      <BookingTimeInput
        value={local}
        change={reset}
        timeZone={timeZone}
        fold={fold}
        setFold={(value) => {
          setFold(value);
          setSelected("");
          choose(undefined);
        }}
      />
      {error && <p className="lp-muted">{error}</p>}
      <label htmlFor="conversion-existing-booking">Existing booking</label>
      <select
        id="conversion-existing-booking"
        required
        value={items.some((item) => item._id === selected) ? selected : ""}
        onChange={(event) => {
          setSelected(event.target.value);
          choose(event.target.value as Booking["_id"]);
        }}
      >
        <option value="">Choose this client's booking</option>
        {items.map((item) => (
          <option key={item._id} value={item._id}>
            {displayBookingTime(item.startsAt, timeZone)} ·{" "}
            {item.serviceSnapshot?.name}
          </option>
        ))}
      </select>
      {result?.hasMore ? (
        <p role="status">
          Only the first 200 matches are shown. Move the window start to narrow
          the results; this is not a complete list.
        </p>
      ) : result && items.length === 0 ? (
        <p>No scheduled linked bookings for this client in this window.</p>
      ) : !result && !error ? (
        <p role="status">Loading bookings…</p>
      ) : null}
    </div>
  );
}
