"use client";
import { useState } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { practiceApi, type TenantId } from "./api";
import { PracticeGmail } from "./gmail";
import type { EnquiryId } from "./enquiry-api";
import { PracticeEnquiries } from "./enquiries";
import { PracticeBookings } from "./bookings";
import { TaskPanel } from "./practice-ui";
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
function PracticeTasks({
  tenantId,
  canWrite,
}: {
  tenantId: TenantId;
  canWrite: boolean;
}) {
  const result = useQuery(practiceApi.tasks, { tenantId });
  const create = useMutation(practiceApi.createTask);
  const complete = useMutation(practiceApi.setCompleted);
  return (
    <TaskPanel
      result={result}
      canWrite={canWrite}
      addTask={(title, requestKey) => create({ tenantId, title, requestKey })}
      setCompleted={(task, completed) =>
        complete({ tenantId, taskId: task._id, completed })
      }
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
    canWrite && gmailStatus ? "gmail" : "tasks",
  );
  const [enquiryId, setEnquiryId] = useState<EnquiryId>();
  return (
    <>
      <PracticeNavigation
        section={section}
        canWrite={canWrite}
        select={(next) => {
          setEnquiryId(undefined);
          setSection(next);
        }}
      />
      {section === "tasks" ? (
        <PracticeTasks tenantId={tenantId} canWrite={canWrite} />
      ) : section === "services" ? (
        <PracticeServices tenantId={tenantId} canWrite={canWrite} />
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
        <PracticeClients tenantId={tenantId} />
      ) : null}
    </>
  );
}

function PracticeServices({
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
      <RecordFilter archived={archived} change={setArchived} noun="Service" />
      <ServicesPanel
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
function PracticeClients({ tenantId }: { tenantId: TenantId }) {
  const [archived, setArchived] = useState(false),
    [search, setSearch] = useState("");
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
      <RecordFilter archived={archived} change={setArchived} noun="Client" />
      <ClientSearch search={search} change={setSearch} />
      <ClientsPanel
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
