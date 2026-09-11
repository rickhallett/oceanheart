import { workosConfigured } from "./practice-config";

export const claraWorkflow = "clara";

export type ClaraInstanceConfig = {
  runtimeUrl: URL;
  origin: string;
};

export function claraInstanceConfig(
  env: Record<string, string | undefined> = process.env,
): ClaraInstanceConfig | null {
  if (env.STUDIO_PRIVATE_WORKFLOW !== claraWorkflow || !workosConfigured(env))
    return null;
  try {
    const runtimeUrl = new URL(env.STUDIO_CLARA_RUNTIME_URL ?? ""),
      callback = new URL(env.NEXT_PUBLIC_WORKOS_REDIRECT_URI!);
    if (
      runtimeUrl.protocol !== "http:" ||
      runtimeUrl.hostname !== "127.0.0.1" ||
      runtimeUrl.username ||
      runtimeUrl.password ||
      runtimeUrl.search ||
      runtimeUrl.hash ||
      runtimeUrl.pathname !== "/v1/clara"
    )
      return null;
    return { runtimeUrl, origin: callback.origin };
  } catch {
    return null;
  }
}

export function claraInstanceConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return claraInstanceConfig(env) !== null;
}
