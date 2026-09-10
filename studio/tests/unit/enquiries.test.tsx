import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EnquiryCapture,
  ReplyDraft,
  ConversionForm,
} from "../../src/components/practice/enquiries";
import type { Enquiry } from "../../src/components/practice/enquiry-api";
import type { Client, Service } from "../../src/components/practice/api";
const record = {
  _id: "enquiry",
  name: "Alex",
  email: "family@example.invalid",
  subject: "Appointment enquiry",
  message: "Please help",
  draft: "",
  resolved: false,
  hasDraft: false,
  revision: 3,
  createdAt: 0,
} as Enquiry;
const client = {
  _id: "client",
  name: "Alex existing",
  email: "family@example.invalid",
  archived: false,
  revision: 0,
  createdAt: 0,
} as Client;
const service = {
  _id: "service",
  name: "Consultation",
  durationMinutes: 60,
  priceMinor: 6250,
  currency: "GBP",
  active: true,
  revision: 0,
  createdAt: 0,
} as Service;
function conversion(convert = vi.fn(), extra = {}) {
  return (
    <ConversionForm
      record={record}
      timeZone="Europe/London"
      clients={{ items: [client], status: "CanLoadMore", loadMore: vi.fn() }}
      services={{ items: [service], status: "Exhausted", loadMore: vi.fn() }}
      search=""
      setSearch={vi.fn()}
      convert={convert}
      done={vi.fn()}
      cancel={vi.fn()}
      existingBookings={() => null}
      {...extra}
    />
  );
}
it("manual capture normalizes optional blanks and retains its key and values on retry", async () => {
  const user = userEvent.setup(),
    create = vi
      .fn()
      .mockRejectedValueOnce(new Error("private network detail"))
      .mockResolvedValue("enquiry");
  render(<EnquiryCapture create={create} done={vi.fn()} cancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Contact name"), " Alex ");
  await user.type(screen.getByLabelText("Subject"), " Visit ");
  await user.type(screen.getByLabelText("Message"), " Hello ");
  await user.type(screen.getByLabelText("Phone (optional)"), "  ");
  await user.click(screen.getByRole("button", { name: "Save enquiry" }));
  expect(screen.getByRole("alert")).not.toHaveTextContent(
    "private network detail",
  );
  expect(screen.getByLabelText("Message")).toHaveValue(" Hello ");
  await user.click(screen.getByRole("button", { name: "Save enquiry" }));
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  expect(create.mock.calls[0][0]).toEqual({
    name: "Alex",
    subject: "Visit",
    message: "Hello",
  });
});
it("draft explicitly remains unsent and revision conflict preserves edited text", async () => {
  const user = userEvent.setup(),
    save = vi.fn().mockRejectedValue({ data: "REVISION_CONFLICT" });
  render(
    <ReplyDraft
      initial="Original"
      save={save}
      done={vi.fn()}
      cancel={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("Reply draft (not sent)"), " changed");
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  expect(screen.getByLabelText("Reply draft (not sent)")).toHaveValue(
    "Original changed",
  );
  expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reload practice" })).toBeVisible();
  expect(screen.getByText(/does not send email/)).toBeVisible();
  expect(save).toHaveBeenCalledWith("Original changed");
});
it("conversion deliberately creates a separate same-email contact and retains its atomic retry payload", async () => {
  const user = userEvent.setup(),
    convert = vi
      .fn()
      .mockRejectedValueOnce({ data: "BOOKING_CONFLICT" })
      .mockResolvedValue({ clientId: "new" });
  render(conversion(convert));
  expect(screen.getByLabelText("Client choice")).toHaveValue("");
  await user.selectOptions(screen.getByLabelText("Client choice"), "new");
  await user.selectOptions(screen.getByLabelText("Booking choice"), "new");
  await user.selectOptions(screen.getByLabelText("Booking service"), "service");
  fireEvent.change(screen.getByLabelText("Start (Europe/London)"), {
    target: { value: "2027-07-15T09:00" },
  });
  await user.click(screen.getByRole("button", { name: "Save links" }));
  expect(screen.getByRole("alert")).toHaveTextContent("overlaps");
  expect(screen.getByLabelText("New client email (optional)")).toHaveValue(
    "family@example.invalid",
  );
  await user.click(screen.getByRole("button", { name: "Save links" }));
  expect(convert.mock.calls[0]).toEqual(convert.mock.calls[1]);
  expect(convert.mock.calls[0][0]).toEqual({
    client: { create: { name: "Alex", email: "family@example.invalid" } },
    booking: {
      create: {
        serviceId: "service",
        startsAt: Date.parse("2027-07-15T08:00Z"),
      },
    },
  });
});
it("linked clients cannot be reassigned and conversion conflicts require reload", async () => {
  const user = userEvent.setup(),
    convert = vi.fn().mockRejectedValue({ data: "LINK_CONFLICT" });
  render(conversion(convert, { record: { ...record, clientId: client._id } }));
  expect(screen.queryByLabelText("Client choice")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save links" }));
  expect(convert.mock.calls[0][0]).toEqual({
    client: { existingId: "client" },
  });
  expect(screen.getByRole("button", { name: "Save links" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reload practice" })).toBeVisible();
});
it("client selection exposes pagination, pending conversion disables controls, and no timezone disables bookings", async () => {
  let resolve!: () => void;
  const convert = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    ),
    more = vi.fn(),
    user = userEvent.setup();
  render(
    conversion(convert, {
      timeZone: undefined,
      clients: { items: [client], status: "CanLoadMore", loadMore: more },
    }),
  );
  await user.selectOptions(screen.getByLabelText("Client choice"), "existing");
  await user.click(screen.getByRole("button", { name: "Load more clients" }));
  expect(more).toHaveBeenCalledOnce();
  expect(screen.getByRole("option", { name: "Create booking" })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Existing client"), "client");
  await user.click(screen.getByRole("button", { name: "Save links" }));
  expect(screen.getByLabelText("Existing client")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => resolve());
});
