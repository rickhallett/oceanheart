const studioRuntimeKeys = [
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
  "WORKOS_COOKIE_PASSWORD",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
  "STUDIO_PRIVATE_WORKFLOW",
  "STUDIO_CLARA_RUNTIME_URL",
] as const;

export function studioRuntimeEnvironment(source: NodeJS.ProcessEnv) {
  const output: NodeJS.ProcessEnv = {};
  for (const key of studioRuntimeKeys) {
    const value = source[key];
    if (value !== undefined) output[key] = value;
  }
  return output;
}
