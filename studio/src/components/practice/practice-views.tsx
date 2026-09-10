"use client";
import { useState } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { practiceApi, type Task, type TaskFilter, type TenantId } from "./api";
import { PracticeGmail } from "./gmail";
import type { EnquiryId } from "./enquiry-api";
import { PracticeEnquiries } from "./enquiries";
import { PracticeBookings } from "./bookings";
import { ClientHistory } from "./client-history";
import { ClientNotes } from "./client-notes";
import { TaskPanel } from "./practice-ui";
import { PracticeSettings } from "./settings";
import { PracticeToday } from "./today";
import {
  ServicesPanel,
  ClientsPanel,
  PracticeNavigation,
  RecordFilter,
  ClientSearch,
  type PracticeSection,
} from "./records-ui";
export function PracticeViews(props: {
  tenantId: TenantId;
  canWrite: boolean;
  timeZone?: string;
  gmailStatus?: string;
}) {
  return (
    <PracticeContent key={`${props.tenantId}:${props.canWrite}`} {...props} />
  );
}
export function PracticeTasks({
  tenantId,
  canWrite,
  openClient,
}: {
  tenantId: TenantId;
  canWrite: boolean;
  openClient?: (client: { name: string; archived: boolean }) => void;
}) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const result = useQuery(practiceApi.tasks, { tenantId, filter });
  const create = useMutation(practiceApi.createTask);
  const complete = useMutation(practiceApi.setCompleted);
  const update = useMutation(practiceApi.updateTask);
  const remove = useMutation(practiceApi.removeTask);
  const shared: {
    result: Parameters<typeof TaskPanel>[0]["result"];
    canWrite: boolean;
    filter: TaskFilter;
    changeFilter: (filter: TaskFilter) => void;
    setCompleted: (task: Task, completed: boolean) => Promise<unknown>;
    removeTask: (task: Task, expectedRevision: number) => Promise<unknown>;
    openClient?: (client: { name: string; archived: boolean }) => void;
  } = {
    result,
    canWrite,
    filter,
    changeFilter: setFilter,
    setCompleted: (task, completed) =>
      complete({
        tenantId,
        taskId: task._id,
        completed,
        expectedRevision: task.revision,
      }),
    removeTask: (task, expectedRevision) =>
      remove({ tenantId, taskId: task._id, expectedRevision }),
    openClient,
  };
  if (!canWrite) {
    // Viewers never mount the owner-only client search; their task
    // projection carries no client fields at all.
    return (
      <TaskPanel
        {...shared}
        addTask={() => Promise.reject(new Error("FORBIDDEN"))}
        updateTask={() => Promise.reject(new Error("FORBIDDEN"))}
      />
    );
  }
  return (
    <OwnedTaskPanel
      tenantId={tenantId}
      shared={shared}
      create={create}
      update={update}
    />
  );
}
type CreateTaskArgs = {
  tenantId: TenantId;
  title: string;
  requestKey: string;
  dueDate?: string;
  clientId?: Task["clientId"];
};
type UpdateTaskArgs = {
  tenantId: TenantId;
  taskId: Task["_id"];
  title: string;
  expectedRevision: number;
  dueDate?: string | null;
  clientId?: Task["clientId"] | null;
};
function OwnedTaskPanel({
  tenantId,
  shared,
  create,
  update,
}: {
  tenantId: TenantId;
  shared: Omit<
    Parameters<typeof TaskPanel>[0],
    | "addTask"
    | "updateTask"
    | "clientOptions"
    | "clientsStatus"
    | "clientSearch"
    | "changeClientSearch"
    | "loadMoreClients"
  >;
  create: (args: CreateTaskArgs) => Promise<unknown>;
  update: (
    args: UpdateTaskArgs,
  ) => Promise<{ taskId: Task["_id"]; revision: number }>;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const {
    results: clientResults,
    status: clientsStatus,
    loadMore: loadMoreClients,
  } = usePaginatedQuery(
    practiceApi.clients,
    { tenantId, archived: false, search: clientSearch },
    { initialNumItems: 20 },
  );
  return (
    <TaskPanel
      {...shared}
      addTask={(title, requestKey, dueDate, clientId) =>
        create({
          tenantId,
          title,
          requestKey,
          ...(dueDate !== undefined ? { dueDate } : {}),
          ...(clientId !== undefined ? { clientId } : {}),
        })
      }
      updateTask={(task, title, expectedRevision, dueDate, clientId) =>
        update({
          tenantId,
          taskId: task._id,
          title,
          expectedRevision,
          ...(dueDate === undefined ? {} : { dueDate }),
          ...(clientId === undefined ? {} : { clientId }),
        })
      }
      clientOptions={(clientResults ?? []).map((client) => ({
        _id: client._id,
        name: client.name,
        archived: client.archived,
      }))}
      clientsStatus={clientsStatus}
      clientSearch={clientSearch}
      changeClientSearch={setClientSearch}
      loadMoreClients={() => loadMoreClients(20)}
    />
  );
}

function PracticeContent({
  tenantId,
  canWrite,
  timeZone,
  gmailStatus,
}: {
  tenantId: TenantId;
  canWrite: boolean;
  timeZone?: string;
  gmailStatus?: string;
}) {
  const [section, setSection] = useState<PracticeSection>(
    canWrite && gmailStatus ? "gmail" : "today",
  );
  const [enquiryId, setEnquiryId] = useState<EnquiryId>();
  const [clientFocus, setClientFocus] = useState<
    { name: string; archived: boolean } | undefined
  >();
  return (
    <>
      <PracticeNavigation
        section={section}
        canWrite={canWrite}
        select={(next) => {
          setEnquiryId(undefined);
          setClientFocus(undefined);
          setSection(next);
        }}
      />
      {section === "today" ? (
        <PracticeToday
          tenantId={tenantId}
          canWrite={canWrite}
          openBookings={() => setSection("bookings")}
        />
      ) : section === "tasks" ? (
        <PracticeTasks
          tenantId={tenantId}
          canWrite={canWrite}
          openClient={
            canWrite
              ? (client) => {
                  setEnquiryId(undefined);
                  setClientFocus(client);
                  setSection("clients");
                }
              : undefined
          }
        />
      ) : section === "services" ? (
        <PracticeServices tenantId={tenantId} canWrite={canWrite} />
      ) : section === "settings" ? (
        <PracticeSettings
          tenantId={tenantId}
          canWrite={canWrite}
          timeZone={timeZone}
        />
      ) : canWrite && section === "gmail" ? (
        <PracticeGmail
          tenantId={tenantId}
          returnStatus={gmailStatus}
          openEnquiry={(id) => {
            setEnquiryId(id);
            setSection("enquiries");
          }}
        />
      ) : canWrite && section === "enquiries" ? (
        <PracticeEnquiries
          tenantId={tenantId}
          timeZone={timeZone}
          initialId={enquiryId}
        />
      ) : canWrite && section === "bookings" ? (
        <PracticeBookings tenantId={tenantId} timeZone={timeZone} />
      ) : canWrite ? (
        <PracticeClients
          key={
            clientFocus ? `${clientFocus.name}||${clientFocus.archived}` : "all"
          }
          tenantId={tenantId}
          focus={clientFocus}
        />
      ) : null}
    </>
  );
}

export function PracticeServices({
  tenantId,
  canWrite,
}: {
  tenantId: TenantId;
  canWrite: boolean;
}) {
  const [archived, setArchived] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    practiceApi.services,
    { tenantId, archived },
    { initialNumItems: 20 },
  );
  const create = useMutation(practiceApi.createService),
    update = useMutation(practiceApi.updateService),
    archive = useMutation(practiceApi.archiveService);
  return (
    <>
      <ServicesPanel
        filters={
          <RecordFilter
            archived={archived}
            change={setArchived}
            noun="Service"
          />
        }
        key={String(archived)}
        items={results}
        status={status}
        canWrite={canWrite}
        archived={archived}
        loadMore={() => loadMore(20)}
        create={(input, requestKey) =>
          create({ ...input, tenantId, requestKey })
        }
        update={(record, input) =>
          update({
            ...input,
            tenantId,
            serviceId: record._id,
            expectedRevision: record.revision,
          })
        }
        archive={(record, archived) =>
          archive({
            tenantId,
            serviceId: record._id,
            archived,
            expectedRevision: record.revision,
          })
        }
      />
    </>
  );
}
export function PracticeClients({
  tenantId,
  focus,
}: {
  tenantId: TenantId;
  focus?: { name: string; archived: boolean };
}) {
  const [archived, setArchived] = useState(focus?.archived ?? false),
    [search, setSearch] = useState(focus?.name ?? "");
  const { results, status, loadMore } = usePaginatedQuery(
    practiceApi.clients,
    { tenantId, archived, search },
    { initialNumItems: 20 },
  );
  const create = useMutation(practiceApi.createClient),
    update = useMutation(practiceApi.updateClient),
    archive = useMutation(practiceApi.archiveClient);
  return (
    <>
      <ClientsPanel
        filters={
          <div className="lp-directory-filters">
            <RecordFilter
              archived={archived}
              change={setArchived}
              noun="Client"
            />
            <ClientSearch key={search} search={search} change={setSearch} />
          </div>
        }
        history={(client) => (
          <>
            <ClientNotes
              key={`notes:${client._id}`}
              tenantId={tenantId}
              client={client}
            />
            <ClientHistory
              key={client._id}
              tenantId={tenantId}
              client={client}
            />
          </>
        )}
        key={`${archived}:${search}`}
        items={results}
        status={status}
        archived={archived}
        search={search}
        loadMore={() => loadMore(20)}
        create={(input, requestKey) =>
          create({ ...input, tenantId, requestKey })
        }
        update={(record, input) =>
          update({
            ...input,
            tenantId,
            clientId: record._id,
            expectedRevision: record.revision,
          })
        }
        archive={(record, archived) =>
          archive({
            tenantId,
            clientId: record._id,
            archived,
            expectedRevision: record.revision,
          })
        }
      />
    </>
  );
}
