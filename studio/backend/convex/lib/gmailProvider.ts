"use node";
export class GoogleFailure extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export async function googleRequest(
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<any> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new GoogleFailure("GMAIL_UNAVAILABLE");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new GoogleFailure("GMAIL_UNAVAILABLE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4000000) {
        await reader.cancel();
        throw new GoogleFailure("MESSAGE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof GoogleFailure) throw error;
    throw new GoogleFailure("GMAIL_UNAVAILABLE");
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GoogleFailure("GMAIL_UNAVAILABLE");
  }
  if (!response.ok)
    throw new GoogleFailure(
      data?.error === "invalid_grant" || response.status === 401
        ? "RECONNECT_REQUIRED"
        : "GMAIL_UNAVAILABLE",
    );
  return data;
}
export const tokenRequest = (fields: Record<string, string>) =>
  googleRequest("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
export const gmailRequest = (path: string, accessToken: string) =>
  googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
