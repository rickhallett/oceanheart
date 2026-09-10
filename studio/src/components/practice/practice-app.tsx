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
} from "convex/react";
import { LiveWorkspace } from "../workspace/live-workspace";

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
        <DataBoundary>
          <AuthenticatedPractice />
        </DataBoundary>
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
  return <LiveWorkspace />;
}
