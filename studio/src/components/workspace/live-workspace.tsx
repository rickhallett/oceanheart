"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useMutation, useQuery } from "convex/react";
import { Shell } from "./workspace";
import { modules, type View } from "./model";
import { practiceApi, type TenantId } from "../practice/api";
import { CreatePractice } from "../practice/practice-ui";
import {
  PracticeTasks,
  PracticeClients,
  PracticeServices,
} from "../practice/practice-views";
import { PracticeBookings, TimeZoneForm } from "../practice/bookings";
import { PracticeSettings } from "../practice/settings";
import { PracticeGmail } from "../practice/gmail";
import { PracticeEnquiries } from "../practice/enquiries";
import type { EnquiryId } from "../practice/enquiry-api";
import { LiveToday } from "./live-today";
import { signOutPractice } from "@/app/practice/actions";
import "../practice/practice.css";
import "../practice/task-maintenance.css";
import "./live-workspace.css";

export function LiveWorkspace() {
  const { user } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const candidate = path.split("/")[2] || "today";
  const view = (
    modules.some(([id]) => id === candidate) ? candidate : "today"
  ) as View;
  const tenants = useQuery(practiceApi.tenants, {});
  const create = useMutation(practiceApi.createTenant);
  const [creating, setCreating] = useState(false);
  // Selection lives in the URL, so navigation, reload and direct links agree.
  const selected = params.get("practice") ?? params.get("gmailTenant");
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  useEffect(() => setPendingSelection(null), [selected]);
  const tenant =
    tenants?.find((t) => t._id === (pendingSelection ?? selected)) ??
    tenants?.[0];
  function go(
    next: View,
    extras: Record<string, string> = {},
    tenantId = tenant?._id,
  ) {
    const query = new URLSearchParams(tenantId ? { practice: tenantId } : {});
    Object.entries(extras).forEach(([key, value]) => query.set(key, value));
    router.push(`${next === "today" ? "/app" : `/app/${next}`}?${query}`);
  }
  const ownerName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Your account";
  const canWrite = tenant?.role === "owner";
  let content;
  if (!tenants) content = <p role="status">Loading practices…</p>;
  else if (creating || !tenant)
    content = (
      <CreatePractice
        create={async (name, requestKey) => {
          const id = await create({ name, requestKey });
          setCreating(false);
          go("today", {}, id);
        }}
        onCancel={tenant ? () => setCreating(false) : undefined}
      />
    );
  else
    content = (
      <LiveScreen
        key={`${tenant._id}:${tenant.role}:${view}:${params.get("search") ?? ""}:${params.get("archived") ?? ""}`}
        view={view}
        tenantId={tenant._id}
        canWrite={!!canWrite}
        timeZone={tenant.timeZone}
        ownerName={ownerName}
        go={go}
      />
    );
  return (
    <div className="ws-root ws-live">
      <Shell
        view={view}
        live={{
          practiceName: tenant?.name ?? "Your practice",
          ownerName,
          role: tenant
            ? canWrite
              ? "Practice owner"
              : "Practice viewer"
            : "Your account",
          href: (v) =>
            `${v === "today" ? "/app" : `/app/${v}`}?${new URLSearchParams(tenant ? { practice: tenant._id } : {})}`,
          go,
          content: <div className="lp-root ws-live-content">{content}</div>,
          picker: tenants?.length ? (
            <div className="ws-live-picker">
              <label htmlFor="practice-selector">Current practice</label>
              <select
                id="practice-selector"
                value={tenant?._id}
                onChange={(e) => {
                  setCreating(false);
                  setPendingSelection(e.target.value);
                  go(view, {}, e.target.value as TenantId);
                }}
              >
                {tenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setCreating(true)}>
                Add a practice
              </button>
            </div>
          ) : undefined,
          account: (
            <form className="ws-live-account" action={signOutPractice}>
              <button type="submit">Sign out</button>
            </form>
          ),
        }}
      />
    </div>
  );
}
function LiveScreen({
  view,
  tenantId,
  canWrite,
  timeZone,
  ownerName,
  go,
}: {
  view: View;
  tenantId: TenantId;
  canWrite: boolean;
  timeZone?: string;
  ownerName: string;
  go: (view: View, extras?: Record<string, string>) => void;
}) {
  const params = useSearchParams();
  const [enquiry, setEnquiry] = useState<EnquiryId>();
  if (view === "today")
    return (
      <LiveToday
        tenantId={tenantId}
        canWrite={canWrite}
        ownerName={ownerName}
        go={go}
      />
    );
  if (view === "tasks")
    return (
      <PracticeTasks
        tenantId={tenantId}
        canWrite={canWrite}
        openClient={
          canWrite
            ? (c) =>
                go("clients", { search: c.name, archived: String(c.archived) })
            : undefined
        }
      />
    );
  if (view === "services")
    return <PracticeServices tenantId={tenantId} canWrite={canWrite} />;
  if (view === "settings" || view === "setup")
    return (
      <>
        {canWrite && (
          <WorkspaceTimeZone tenantId={tenantId} timeZone={timeZone} />
        )}
        <PracticeSettings
          tenantId={tenantId}
          canWrite={canWrite}
          timeZone={timeZone}
        />
        {canWrite && (
          <div className="ws-live-connections">
            <h2>Connections</h2>
            <PracticeGmail
              tenantId={tenantId}
              returnStatus={params.get("gmailStatus") ?? undefined}
              openEnquiry={(id) => go("inbox", { enquiry: id })}
            />
          </div>
        )}
      </>
    );
  if (!canWrite && ["clients", "calendar", "inbox"].includes(view))
    return (
      <div className="lp-empty">
        <h2>Owner access required</h2>
        <p>
          Your account can view tasks, Today, services and practice settings.
        </p>
      </div>
    );
  if (view === "clients")
    return (
      <PracticeClients
        tenantId={tenantId}
        focus={
          params.has("search")
            ? {
                name: params.get("search")!,
                archived: params.get("archived") === "true",
              }
            : undefined
        }
      />
    );
  if (view === "calendar")
    return (
      <PracticeBookings
        tenantId={tenantId}
        timeZone={timeZone}
        initialAdding={params.get("new") === "booking"}
      />
    );
  if (view === "inbox")
    return (
      <>
        <PracticeEnquiries
          tenantId={tenantId}
          timeZone={timeZone}
          initialId={(params.get("enquiry") as EnquiryId) || enquiry}
        />
        <details className="ws-live-connections">
          <summary>Import from Gmail</summary>
          <PracticeGmail tenantId={tenantId} openEnquiry={setEnquiry} />
        </details>
      </>
    );
  return (
    <div className="lp-empty">
      <h2>{modules.find(([id]) => id === view)?.[1]}</h2>
      <p>This part of your workspace is not connected yet.</p>
      <button onClick={() => go("today")}>Back to Today</button>
    </div>
  );
}

function WorkspaceTimeZone({
  tenantId,
  timeZone,
}: {
  tenantId: TenantId;
  timeZone?: string;
}) {
  const save = useMutation(practiceApi.setTimeZone);
  return (
    <TimeZoneForm
      key={timeZone ?? "unset"}
      current={timeZone}
      save={(zone) =>
        save({ tenantId, timeZone: zone, expectedTimeZone: timeZone ?? null })
      }
    />
  );
}
