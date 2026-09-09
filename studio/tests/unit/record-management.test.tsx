import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ServicesPanel,
  ClientsPanel,
  ClientSearch,
} from "../../src/components/practice/records-ui";
import type { Service, Client } from "../../src/components/practice/api";
const service: Service = {
  _id: "service" as Service["_id"],
  name: "Consultation",
  durationMinutes: 60,
  priceMinor: 6250,
  currency: "GBP",
  active: true,
  createdAt: 1,
  revision: 2,
};
const client: Client = {
  _id: "client" as Client["_id"],
  name: "Alex",
  email: "shared@example.test",
  archived: false,
  revision: 3,
  createdAt: 1,
};
it("editing initializes current values and preserves the original revision on a lost-response retry", async () => {
  const user = userEvent.setup(),
    update = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue("service");
  render(
    <ServicesPanel
      items={[service]}
      status="Exhausted"
      canWrite
      create={vi.fn()}
      loadMore={vi.fn()}
      update={update}
      archive={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByLabelText("Service name")).toHaveValue("Consultation");
  expect(screen.getByLabelText("Price (£)")).toHaveValue("62.50");
  await user.clear(screen.getByLabelText("Price (£)"));
  await user.type(screen.getByLabelText("Price (£)"), "70.29");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(update.mock.calls[0]).toEqual(update.mock.calls[1]);
  expect(update.mock.calls[0][0].revision).toBe(2);
  expect(update.mock.calls[0][1].priceMinor).toBe(7029);
});
it("conflicting edits retain entered data and require reload before resubmission", async () => {
  const user = userEvent.setup(),
    update = vi.fn().mockRejectedValue(new Error("REVISION_CONFLICT"));
  render(
    <ClientsPanel
      items={[client]}
      status="Exhausted"
      create={vi.fn()}
      loadMore={vi.fn()}
      update={update}
      archive={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.type(screen.getByLabelText("Client name"), " revised");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByLabelText("Client name")).toHaveValue("Alex revised");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reload practice" })).toBeVisible();
  expect(update).toHaveBeenCalledTimes(1);
});
it("archive and restore preserve record identity and use the selected desired state", async () => {
  const user = userEvent.setup(),
    archive = vi.fn().mockResolvedValue("service");
  const props = {
    items: [service],
    status: "Exhausted" as const,
    canWrite: true,
    create: vi.fn(),
    loadMore: vi.fn(),
    update: vi.fn(),
    archive,
  };
  const view = render(<ServicesPanel {...props} />);
  await user.click(screen.getByRole("button", { name: "Archive" }));
  expect(archive).toHaveBeenCalledWith(service, true);
  view.rerender(
    <ServicesPanel
      {...props}
      archived
      items={[{ ...service, active: false, revision: 3 }]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Restore" }));
  expect(archive.mock.calls[1][0]._id).toBe(service._id);
  expect(archive.mock.calls[1][1]).toBe(false);
});
it("a family contact can reuse an existing email without merging records", async () => {
  const user = userEvent.setup(),
    create = vi.fn().mockResolvedValue("second-client");
  render(
    <ClientsPanel
      items={[client]}
      status="Exhausted"
      create={create}
      loadMore={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Add client" }));
  await user.type(screen.getByLabelText("Client name"), "Jamie");
  await user.type(screen.getByLabelText("Email (optional)"), client.email!);
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(create.mock.calls[0][0]).toEqual({
    name: "Jamie",
    email: client.email,
  });
  expect(screen.getByRole("heading", { name: "Alex" })).toBeVisible();
});
it("client search submits normalized name/email terms and rejects excessive token count", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(<ClientSearch search="" change={change} />);
  const input = screen.getByLabelText("Search clients by name or email");
  await user.type(input, " shared@example.test ");
  await user.click(screen.getByRole("button", { name: "Search" }));
  expect(change).toHaveBeenLastCalledWith("shared@example.test");
  await user.clear(input);
  await user.type(input, Array(17).fill("a").join(" "));
  await user.click(screen.getByRole("button", { name: "Search" }));
  expect(change).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert")).toHaveTextContent("16 search terms");
});
