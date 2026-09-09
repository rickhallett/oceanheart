import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ServicesPanel,
  ClientsPanel,
  PracticeNavigation,
} from "../../src/components/practice/records-ui";
import { poundsToMinor } from "../../src/components/practice/money";
it.each([
  ["0", 0],
  ["0.10", 10],
  ["0.29", 29],
  ["62.5", 6250],
  [" 62.50 ", 6250],
  ["1000000.00", 100000000],
])("converts %s pounds exactly to %s pence", (value, expected) => {
  expect(poundsToMinor(String(value))).toBe(expected);
});
it.each(["", "-1", "1.001", "1e2", "1,000", "NaN", "1000000.01"])(
  "rejects ambiguous or out-of-range price %s",
  (value) => {
    expect(() => poundsToMinor(value)).toThrow();
  },
);
it("service retries retain values and a stable key, then close after a confirmed save", async () => {
  const user = userEvent.setup();
  const create = vi
    .fn()
    .mockRejectedValueOnce(new Error("network secret"))
    .mockResolvedValue("service");
  render(
    <ServicesPanel
      items={[]}
      status="Exhausted"
      canWrite
      create={create}
      loadMore={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Add service" }));
  await user.type(screen.getByLabelText("Service name"), " Consultation ");
  await user.type(screen.getByLabelText("Price (£)"), "62.50");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByLabelText("Price (£)")).toHaveValue("62.50");
  expect(screen.getByRole("alert")).not.toHaveTextContent("network secret");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  expect(create.mock.calls[0][0]).toEqual({
    name: "Consultation",
    durationMinutes: 60,
    priceMinor: 6250,
    currency: "GBP",
  });
  expect(screen.queryByLabelText("Service name")).not.toBeInTheDocument();
});
it("invalid precision never invokes the service command", async () => {
  const user = userEvent.setup();
  const create = vi.fn();
  render(
    <ServicesPanel
      items={[]}
      status="Exhausted"
      canWrite
      create={create}
      loadMore={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Add service" }));
  await user.type(screen.getByLabelText("Service name"), "Consultation");
  await user.type(screen.getByLabelText("Price (£)"), "0.001");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("two decimal places");
});
it("client pending state disables all form controls and omits optional blanks", async () => {
  const user = userEvent.setup();
  let resolve!: (value: string) => void;
  const create = vi.fn(
    (_input: unknown, _key: string) =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  render(
    <ClientsPanel
      items={[]}
      status="Exhausted"
      create={create}
      loadMore={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Add client" }));
  await user.type(screen.getByLabelText("Client name"), " Alex ");
  await user.type(screen.getByLabelText("Phone (optional)"), "   ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(create.mock.calls[0][0]).toEqual({ name: "Alex" });
  expect(screen.getByLabelText("Client name")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  resolve("client");
  await screen.findByText("Client saved.");
});
it("viewers have service reads without create or client navigation", () => {
  render(
    <>
      <PracticeNavigation
        section="services"
        canWrite={false}
        select={vi.fn()}
      />
      <ServicesPanel
        items={[]}
        status="Exhausted"
        canWrite={false}
        create={vi.fn()}
        loadMore={vi.fn()}
      />
    </>,
  );
  expect(
    screen.queryByRole("button", { name: "Clients" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Add service" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("View-only access")).toBeVisible();
});
it("load more preserves displayed results and disables duplicate requests while loading", async () => {
  const user = userEvent.setup();
  const loadMore = vi.fn();
  const props = { items: [], canWrite: false, create: vi.fn(), loadMore };
  const view = render(<ServicesPanel {...props} status="CanLoadMore" />);
  await user.click(screen.getByRole("button", { name: "Load more services" }));
  expect(loadMore).toHaveBeenCalledTimes(1);
  view.rerender(<ServicesPanel {...props} status="LoadingMore" />);
  expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  view.rerender(<ServicesPanel {...props} status="Exhausted" />);
  expect(
    screen.queryByRole("button", { name: /Load more/ }),
  ).not.toBeInTheDocument();
});
