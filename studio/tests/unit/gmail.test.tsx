import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GmailPanel } from "../../src/components/practice/gmail";
import type { TenantId } from "../../src/components/practice/api";
const message = {
  id: "one",
  threadId: "thread",
  subject: "Appointment enquiry",
  from: "Alex <alex@example.invalid>",
  date: "Today",
  snippet: "Please help",
  text: "<script>privateMessage()</script>",
  bodyTruncated: true,
  plainTextAvailable: true,
  hasAttachments: true,
};
function panel(extra = {}) {
  return (
    <GmailPanel
      tenantId={"tenant" as TenantId}
      status={{
        connected: true,
        needsReconnect: false,
        mailbox: "owner@example.invalid",
        generation: 1,
      }}
      list={vi.fn().mockResolvedValue({ items: [message] })}
      preview={vi.fn().mockResolvedValue(message)}
      importMessage={vi
        .fn()
        .mockResolvedValue({ enquiryId: "enquiry", alreadyImported: false })}
      disconnect={vi.fn().mockResolvedValue({ providerRevoked: true })}
      openEnquiry={vi.fn()}
      {...extra}
    />
  );
}
it("does not browse or import automatically; preview is text and import is explicit", async () => {
  const user = userEvent.setup(),
    list = vi.fn().mockResolvedValue({ items: [message] }),
    preview = vi.fn().mockResolvedValue(message),
    importMessage = vi
      .fn()
      .mockResolvedValue({ enquiryId: "enquiry", alreadyImported: false });
  render(<StrictMode>{panel({ list, preview, importMessage })}</StrictMode>);
  expect(list).not.toHaveBeenCalled();
  expect(importMessage).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Browse Gmail messages" }),
  );
  await user.click(screen.getByRole("button", { name: /Alex.*Today.*Appointment enquiry/ }));
  expect(preview).toHaveBeenCalledWith("one");
  expect(screen.getByText(message.text)).toBeVisible();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByText("Attachments are not imported.")).toBeVisible();
  expect(importMessage).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Import selected message" }),
  );
  expect(importMessage).toHaveBeenCalledWith("one");
  expect(
    screen.getByText("Message imported as an enquiry. Nothing was sent."),
  ).toBeVisible();
});
it("explicit next page preserves selection and imports retries safely with same message ID", async () => {
  const user = userEvent.setup(),
    list = vi
      .fn()
      .mockResolvedValueOnce({ items: [message], nextPageToken: "next" })
      .mockResolvedValue({
        items: [{ ...message, id: "two", subject: "Second" }],
      }),
    importMessage = vi
      .fn()
      .mockRejectedValueOnce({ data: "GMAIL_PROVIDER_ERROR" })
      .mockResolvedValue({ enquiryId: "enquiry", alreadyImported: true });
  render(panel({ list, importMessage }));
  await user.click(
    screen.getByRole("button", { name: "Browse Gmail messages" }),
  );
  await user.click(screen.getByRole("button", { name: "Load more messages" }));
  expect(list).toHaveBeenLastCalledWith("next");
  await user.click(screen.getByRole("button", { name: /Alex.*Today.*Appointment enquiry/ }));
  await user.click(
    screen.getByRole("button", { name: "Import selected message" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Gmail could not complete",
  );
  await user.click(
    screen.getByRole("button", { name: "Import selected message" }),
  );
  expect(importMessage.mock.calls).toEqual([["one"], ["one"]]);
  expect(screen.getByText("This message was already imported.")).toBeVisible();
});
it("unmounted mailbox cannot display a late page in another practice", async () => {
  let resolve!: (value: unknown) => void;
  const user = userEvent.setup(),
    list = vi.fn(
      () =>
        new Promise<any>((done) => {
          resolve = done;
        }),
    );
  const view = render(panel({ list }));
  await user.click(
    screen.getByRole("button", { name: "Browse Gmail messages" }),
  );
  view.rerender(<p>Other practice</p>);
  await act(async () => resolve({ items: [message] }));
  expect(screen.queryByText(message.subject)).not.toBeInTheDocument();
  expect(screen.getByText("Other practice")).toBeVisible();
});
it("disconnected state exposes connect only and never lists mailbox contents", () => {
  const list = vi.fn();
  render(
    panel({
      status: { connected: false, needsReconnect: false, generation: 2 },
      list,
    }),
  );
  expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Browse Gmail messages" }),
  ).not.toBeInTheDocument();
  expect(list).not.toHaveBeenCalled();
});
it("HTML-only messages cannot be imported", async () => {
  const user = userEvent.setup(),
    importMessage = vi.fn();
  render(
    panel({
      preview: vi
        .fn()
        .mockResolvedValue({ ...message, text: "", plainTextAvailable: false }),
      importMessage,
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Browse Gmail messages" }),
  );
  await user.click(screen.getByRole("button", { name: /Alex.*Today.*Appointment enquiry/ }));
  expect(
    screen.getByRole("button", { name: "Import selected message" }),
  ).toBeDisabled();
  expect(importMessage).not.toHaveBeenCalled();
});
it("connected mailboxes expose disconnect without an unsupported reconnect action", () => {
  render(panel());
  expect(
    screen.getByRole("button", { name: "Disconnect Gmail" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reconnect Gmail" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Connect Gmail" }),
  ).not.toBeInTheDocument();
});

it("expired grants offer reconnect without browsing stale contents", () => {
  render(
    panel({
      status: { connected: false, needsReconnect: true, generation: 3 },
    }),
  );
  expect(screen.getByRole("button", { name: "Reconnect Gmail" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Browse Gmail messages" }),
  ).not.toBeInTheDocument();
});
