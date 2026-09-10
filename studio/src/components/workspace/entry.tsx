"use client";
import { useRouter } from "next/navigation";
import { Shell } from "./workspace";
export function WorkspaceEntry({ authError }: { authError?: boolean }) {
  const router = useRouter();
  return (
    <div className="ws-root">
      <Shell
        view="today"
        live={{
          practiceName: "Your practice",
          ownerName: "Your account",
          role: "Welcome",
          go: () => router.push("/sign-in"),
          content: (
            <div className="ws-welcome">
              <div>
                <p className="ws-date-label">oceanheart Studio</p>
                <h1>Your practice, together.</h1>
                <p>Sign in to open your workspace.</p>
                {authError && (
                  <p role="alert">
                    Sign-in could not be completed. Please try again.
                  </p>
                )}
                <a className="ws-entry-signin" href="/sign-in">
                  Sign in
                </a>
                <p><a href="/app?demo=1">Explore the fictional demo</a></p>
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
