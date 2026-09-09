import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { practiceConfigured } from "./practice-config";
export const gmailCookie = "studio-gmail-oauth";
export const gmailPath = "/practice/integrations/gmail";
export type GmailCookie = {
  v: 1;
  state: string;
  browserBinding: string;
  userId: string;
  sessionId: string;
  tenantId: string;
  expiresAt: number;
};
export function gmailConfig() {
  if (!practiceConfigured()) throw Error("GMAIL_NOT_CONFIGURED");
  const raw = process.env.GMAIL_ROUTE_SIGNING_KEY ?? "",
    key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw)
    throw Error("GMAIL_NOT_CONFIGURED");
  return {
    origin: new URL(process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI!).origin,
    key,
    cookieKey: process.env.WORKOS_COOKIE_PASSWORD!,
  };
}
function cookieSignature(payload: string) {
  return createHmac("sha256", gmailConfig().cookieKey)
    .update("studio-gmail-cookie-v1:" + payload)
    .digest("base64url");
}
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function sealGmailCookie(value: GmailCookie) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return payload + "." + cookieSignature(payload);
}
export function openGmailCookie(
  value: string | undefined,
  userId: string,
  sessionId: string,
  now = Date.now(),
): GmailCookie {
  if (!value || value.length > 4096) throw Error("GMAIL_STATE_INVALID");
  const [payload, signature, ...extra] = value.split(".");
  if (extra.length || !signature || !equal(signature, cookieSignature(payload)))
    throw Error("GMAIL_STATE_INVALID");
  const data = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as GmailCookie;
  if (
    data.v !== 1 ||
    data.userId !== userId ||
    data.sessionId !== sessionId ||
    !Number.isSafeInteger(data.expiresAt) ||
    data.expiresAt <= now ||
    data.expiresAt > now + 600000 ||
    !/^[a-f0-9]{64}$/.test(data.browserBinding) ||
    typeof data.state !== "string" ||
    !data.state ||
    typeof data.tenantId !== "string" ||
    !data.tenantId
  )
    throw Error("GMAIL_STATE_INVALID");
  return data;
}
export function gmailProof(value: {
  purpose: "begin" | "complete";
  userId: string;
  sessionId: string;
  browserBinding: string;
  tenantId?: string;
  state?: string;
  codeHash?: string;
}) {
  const payload = JSON.stringify({ v: 1, ...value, issuedAt: Date.now() });
  return {
    payload,
    signature: createHmac("sha256", gmailConfig().key)
      .update(payload)
      .digest("base64url"),
  };
}
export function codeHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
