"use client";
import { useState } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { practiceApi, type TenantId } from "./api";
import { TaskPanel } from "./practice-ui";
import {
  ServicesPanel,
  ClientsPanel,
  PracticeNavigation,
  type PracticeSection,
} from "./records-ui";
export function PracticeViews(props: {
  tenantId: TenantId;
  canWrite: boolean;
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
}: {
  tenantId: TenantId;
  canWrite: boolean;
}) {
  const [section, setSection] = useState<PracticeSection>("tasks");
  return (
    <>
      <PracticeNavigation
        section={section}
        canWrite={canWrite}
        select={setSection}
      />
      {section === "tasks" ? (
        <PracticeTasks tenantId={tenantId} canWrite={canWrite} />
      ) : section === "services" ? (
        <PracticeServices tenantId={tenantId} canWrite={canWrite} />
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
  const { results, status, loadMore } = usePaginatedQuery(
    practiceApi.services,
    { tenantId },
    { initialNumItems: 20 },
  );
  const create = useMutation(practiceApi.createService);
  return (
    <ServicesPanel
      items={results}
      status={status}
      canWrite={canWrite}
      loadMore={() => loadMore(20)}
      create={(input, requestKey) => create({ ...input, tenantId, requestKey })}
    />
  );
}
function PracticeClients({ tenantId }: { tenantId: TenantId }) {
  const { results, status, loadMore } = usePaginatedQuery(
    practiceApi.clients,
    { tenantId },
    { initialNumItems: 20 },
  );
  const create = useMutation(practiceApi.createClient);
  return (
    <ClientsPanel
      items={results}
      status={status}
      loadMore={() => loadMore(20)}
      create={(input, requestKey) => create({ ...input, tenantId, requestKey })}
    />
  );
}
