import { readableError } from "../../src/components/practice/api";
import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BookingForm,
  BookingRow,
  RescheduleForm,
  TimeZoneForm,
} from "../../src/components/practice/bookings";
import {
  bookingTimeChoices,
  resolveBookingTime,
  bookingDay,
} from "../../src/components/practice/booking-time";
import type {
  Booking,
  Client,
  Service,
} from "../../src/components/practice/api";
const client = {
  _id: "client",
  name: "Alex",
  archived: false,
  revision: 0,
  createdAt: 0,
} as Client;
const service = {
  _id: "service",
  name: "Consultation",
  durationMinutes: 90,
  priceMinor: 6250,
  currency: "GBP",
  active: true,
  revision: 0,
  createdAt: 0,
} as Service;
const booking = {
  _id: "booking" as Booking["_id"],
  clientLabel: "Alex",
  startsAt: Date.parse("2027-01-15T23:30Z"),
  endsAt: Date.parse("2027-01-16T01:00Z"),
  status: "scheduled",
  revision: 2,
  legacy: false,
  serviceSnapshot: service,
  timeZone: "Europe/London",
} as Booking;
function form(create = vi.fn(), extra = {}) {
  return (
    <BookingForm
      day="2027-01-15"
      timeZone="Europe/London"
      search=""
      setSearch={vi.fn()}
      clients={{ items: [client], status: "CanLoadMore", loadMore: vi.fn() }}
      services={{ items: [service], status: "CanLoadMore", loadMore: vi.fn() }}
      create={create}
      done={vi.fn()}
      cancel={vi.fn()}
      {...extra}
    />
  );
}
it("rejects DST gaps and requires an explicit repeated-hour choice", () => {
  expect(() => bookingTimeChoices("2027-03-28T01:30", "Europe/London")).toThrow(
    "does not exist",
  );
  expect(() =>
    bookingTimeChoices("2027-03-14T02:30", "America/New_York"),
  ).toThrow("does not exist");
  expect(() =>
    resolveBookingTime("2027-10-31T01:30", "Europe/London", ""),
  ).toThrow("occurs twice");
  expect(
    resolveBookingTime("2027-10-31T01:30", "Europe/London", "earlier"),
  ).toBe(Date.parse("2027-10-31T00:30Z"));
  expect(resolveBookingTime("2027-10-31T01:30", "Europe/London", "later")).toBe(
    Date.parse("2027-10-31T01:30Z"),
  );
  expect(resolveBookingTime("2027-07-15T09:00", "Europe/London", "")).toBe(
    Date.parse("2027-07-15T08:00Z"),
  );
  expect(() => bookingTimeChoices("2027-02-30T09:00", "Europe/London")).toThrow(
    "valid date",
  );
});
it("uses local day boundaries across 23 and 25 hour days", () => {
  for (const [day, hours] of [
    ["2027-03-28", 23],
    ["2027-10-31", 25],
  ] as const) {
    const { from, to } = bookingDay(day, "Europe/London");
    expect(to - from).toBe(hours * 3600000);
  }
  expect(() => bookingDay("2011-12-30", "Pacific/Apia")).toThrow(
    "does not exist",
  );
});
it("timezone suggestion is only saved by an explicit action", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<TimeZoneForm save={save} />);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Practice time zone")).toHaveValue(
    "Europe/London",
  );
  await user.click(screen.getByRole("button", { name: "Save time zone" }));
  expect(save).toHaveBeenCalledWith("Europe/London");
});
it("booking conflict preserves values and reuses the create retry key", async () => {
  const create = vi
    .fn()
    .mockRejectedValueOnce({ data: "BOOKING_CONFLICT" })
    .mockResolvedValue("booking");
  const user = userEvent.setup();
  render(form(create));
  await user.selectOptions(screen.getByLabelText("Client"), "client");
  await user.selectOptions(screen.getByLabelText("Service"), "service");
  await user.click(screen.getByRole("button", { name: "Save booking" }));
  expect(screen.getByRole("alert")).toHaveTextContent("overlaps");
  expect(screen.getByLabelText("Client")).toHaveValue("client");
  await user.click(screen.getByRole("button", { name: "Save booking" }));
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  expect(create.mock.calls[0][0].startsAt).toBe(
    Date.parse("2027-01-15T09:00Z"),
  );
});
it("all pending controls lock and paginated pickers expose load more", async () => {
  let resolve!: () => void;
  const create = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const more = vi.fn();
  const user = userEvent.setup();
  render(
    form(create, {
      clients: { items: [client], status: "CanLoadMore", loadMore: more },
    }),
  );
  await user.click(screen.getByRole("button", { name: "Load more clients" }));
  expect(more).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("button", { name: "Load more services" }),
  ).toBeEnabled();
  await user.selectOptions(screen.getByLabelText("Client"), "client");
  await user.selectOptions(screen.getByLabelText("Service"), "service");
  await user.click(screen.getByRole("button", { name: "Save booking" }));
  expect(screen.getByLabelText("Client")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => resolve());
});
it("repeated-hour form sends only the deliberately chosen instant", async () => {
  const create = vi.fn().mockResolvedValue("booking");
  const user = userEvent.setup();
  render(form(create));
  await user.selectOptions(screen.getByLabelText("Client"), "client");
  await user.selectOptions(screen.getByLabelText("Service"), "service");
  fireEvent.change(screen.getByLabelText("Start (Europe/London)"), {
    target: { value: "2027-10-31T01:30" },
  });
  await user.click(screen.getByRole("button", { name: "Save booking" }));
  expect(create).not.toHaveBeenCalled();
  await user.selectOptions(
    screen.getByLabelText("This time occurs twice. Choose an occurrence"),
    "later",
  );
  await user.click(screen.getByRole("button", { name: "Save booking" }));
  expect(create.mock.calls[0][0].startsAt).toBe(
    Date.parse("2027-10-31T01:30Z"),
  );
});
it("structured revision conflicts block overwrite and offer reload", async () => {
  const save = vi.fn().mockRejectedValue({ data: "REVISION_CONFLICT" });
  const user = userEvent.setup();
  render(
    <RescheduleForm
      booking={booking}
      timeZone="Europe/London"
      save={save}
      done={vi.fn()}
      cancel={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Save new time" }));
  expect(screen.getByRole("alert")).toHaveTextContent("changed since");
  expect(screen.getByRole("button", { name: "Save new time" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reload practice" })).toBeVisible();
});
it("overnight rows display both dates and saved terms, legacy rows only allow cancellation", () => {
  const view = render(
    <ul>
      <BookingRow
        booking={booking}
        timeZone="Europe/London"
        edit={vi.fn()}
        cancel={vi.fn()}
      />
    </ul>,
  );
  expect(screen.getByText(/15 Jan.*16 Jan/)).toBeVisible();
  expect(screen.getByText(/Consultation · 90 minutes · £62.50/)).toBeVisible();
  view.rerender(
    <ul>
      <BookingRow
        booking={{ ...booking, legacy: true, serviceSnapshot: undefined }}
        timeZone="Europe/London"
        edit={vi.fn()}
        cancel={vi.fn()}
      />
    </ul>,
  );
  expect(
    screen.queryByRole("button", { name: "Reschedule" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel booking" })).toBeVisible();
});

it.each([
  ["ARCHIVED_RECORD", "Choose an active record"],
  ["BOOKING_CANCELLED", "has been cancelled"],
  ["INVALID_TIME_ZONE", "valid IANA time zone"],
])(
  "maps the actual %s booking error without exposing internals",
  (code, guidance) => {
    expect(readableError({ data: code })).toContain(guidance);
  },
);
