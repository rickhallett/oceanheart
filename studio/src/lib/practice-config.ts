// Never expose provider secrets in the browser. Shared server-side readiness gate.
export function practiceConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (
    !env.WORKOS_CLIENT_ID ||
    !env.WORKOS_API_KEY ||
    (env.WORKOS_COOKIE_PASSWORD?.length ?? 0) < 32 ||
    !env.NEXT_PUBLIC_CONVEX_URL ||
    !env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
  )
    return false;
  try {
    const callback = new URL(env.NEXT_PUBLIC_WORKOS_REDIRECT_URI);
    const database = new URL(env.NEXT_PUBLIC_CONVEX_URL);
    return (
      !callback.username &&
      !callback.password &&
      !database.username &&
      !database.password &&
      callback.pathname === "/callback" &&
      !callback.search &&
      !callback.hash &&
      (callback.protocol === "https:" ||
        (callback.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(callback.hostname))) &&
      (database.protocol === "https:" ||
        (database.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(database.hostname)))
    );
  } catch {
    return false;
  }
}
