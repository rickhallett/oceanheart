"use node";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function key(value: string | undefined) {
  const bytes = Buffer.from(value ?? "", "base64");
  if (bytes.length !== 32) throw new Error("GMAIL_NOT_CONFIGURED");
  return bytes;
}
export function encrypt(value: string, aad: string, keyBytes: Buffer) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", keyBytes, iv);
  cipher.setAAD(Buffer.from(aad));
  return [
    "v1",
    iv.toString("base64url"),
    Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString(
      "base64url",
    ),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
export function decrypt(value: string, aad: string, keyBytes: Buffer) {
  const [version, iv, body, tag] = value.split(".");
  if (version !== "v1" || !iv || !body || !tag)
    throw new Error("INVALID_TOKEN_CIPHERTEXT");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export function routeProof(
  proof: { payload: string; signature: string },
  secret: Buffer,
  expected: Record<string, unknown>,
  now = Date.now(),
) {
  if (proof.payload.length > 4096) throw new Error("INVALID_ROUTE_PROOF");
  const actual = Buffer.from(proof.signature, "base64url"),
    wanted = createHmac("sha256", secret).update(proof.payload).digest();
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
    throw new Error("INVALID_ROUTE_PROOF");
  const payload = JSON.parse(proof.payload);
  if (
    payload.v !== 1 ||
    !Number.isSafeInteger(payload.issuedAt) ||
    now - payload.issuedAt > 120000 ||
    payload.issuedAt - now > 30000 ||
    typeof payload.sessionId !== "string" ||
    !payload.sessionId ||
    payload.sessionId.length > 200
  )
    throw new Error("INVALID_ROUTE_PROOF");
  for (const [field, value] of Object.entries(expected))
    if (payload[field] !== value) throw new Error("INVALID_ROUTE_PROOF");
  return payload as { sessionId: string };
}
export const opaque = () => randomBytes(32).toString("hex");
