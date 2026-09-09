"use client";
import {
  Component,
  useCallback,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  AuthKitProvider,
  useAuth,
  useAccessToken,
} from "@workos-inc/authkit-nextjs/components";
import {
  ConvexProviderWithAuth,
  ConvexReactClient,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { signOutPractice } from "@/app/practice/actions";
import { practiceApi, type TenantId } from "./api";
import { CreatePractice, PracticeShell } from "./practice-ui";
import { PracticeViews } from "./practice-views";

function useWorkOSAuth() {
  const { user, loading } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      try {
        return (
          (await (forceRefreshToken ? refresh() : getAccessToken())) ?? null
        );
      } catch {
        return null;
      }
    },
    [user, refresh, getAccessToken],
  );
  return { isLoading: loading, isAuthenticated: !!user, fetchAccessToken };
}
export function PracticeApp({
  convexUrl,
  initialAuth,
}: {
  convexUrl: string;
  initialAuth: ComponentProps<typeof AuthKitProvider>["initialAuth"];
}) {
  const [client] = useState(() => new ConvexReactClient(convexUrl));
  return (
    <AuthKitProvider initialAuth={initialAuth}>
      <ConvexProviderWithAuth client={client} useAuth={useWorkOSAuth}>
        <PracticeShell
          account={
            <form action={signOutPractice}>
              <button type="submit">Sign out</button>
            </form>
          }
        >
          <DataBoundary>
            <AuthenticatedPractice />
          </DataBoundary>
        </PracticeShell>
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}
class DataBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="lp-intro">
        <h1>Practice could not be loaded</h1>
        <p role="alert">
          Check your connection and reload. If your access has changed, sign in
          again.
        </p>
        <button onClick={() => window.location.reload()}>
          Reload practice
        </button>{" "}
        <a href="/sign-in">Sign in again</a>
      </section>
    ) : (
      this.props.children
    );
  }
}
function AuthenticatedPractice() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) return <p role="status">Connecting to your practice…</p>;
  if (!isAuthenticated)
    return (
      <section className="lp-intro">
        <h1>Session could not be verified</h1>
        <p role="alert">Please sign in again to connect to your practice.</p>
        <a className="lp-button" href="/sign-in">
          Sign in again
        </a>
      </section>
    );
  return <PracticeWorkspace />;
}
function PracticeWorkspace() {
  const tenants = useQuery(practiceApi.tenants, {});
  const createTenant = useMutation(practiceApi.createTenant);
  const [selected, setSelected] = useState<TenantId | null>(null);
  const [creating, setCreating] = useState(false);
  if (!tenants) return <p role="status">Loading practices…</p>;
  const tenant = tenants.find((t) => t._id === selected) ?? tenants[0];
  if (creating || !tenant)
    return (
      <CreatePractice
        create={async (name, requestKey) => {
          setSelected(await createTenant({ name, requestKey }));
          setCreating(false);
        }}
        onCancel={tenants.length ? () => setCreating(false) : undefined}
      />
    );
  return (
    <>
      <div className="lp-workspace-heading">
        <div>
          <span className="lp-eyebrow">Practice</span>
          <h1>{tenant.name}</h1>
        </div>
        <div className="lp-picker">
          <label htmlFor="practice-selector">Current practice</label>
          <select
            id="practice-selector"
            value={tenant._id}
            onChange={(e) => setSelected(e.target.value as TenantId)}
          >
            {tenants.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
          <button onClick={() => setCreating(true)}>Add a practice</button>
        </div>
      </div>
      <PracticeViews
        key={`${tenant._id}:${tenant.role}`}
        tenantId={tenant._id}
        canWrite={tenant.role === "owner"}
      />
    </>
  );
}
