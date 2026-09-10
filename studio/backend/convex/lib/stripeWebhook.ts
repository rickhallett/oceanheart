export type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  api_version: string | null;
  data: { object: { id?: string } };
};

function sameHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyStripeWebhook(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StripeWebhookEvent> {
  if (!header || !/^whsec_[A-Za-z0-9_]+$/.test(secret))
    throw new Error("INVALID_STRIPE_SIGNATURE");
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t" && /^\d+$/.test(value ?? "")) timestamp = Number(value);
    if (key === "v1" && /^[a-f0-9]{64}$/.test(value ?? "")) signatures.push(value);
  }
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp!) > 300 ||
    signatures.length === 0
  )
    throw new Error("INVALID_STRIPE_SIGNATURE");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (!signatures.some((signature) => sameHex(signature, expected)))
    throw new Error("INVALID_STRIPE_SIGNATURE");
  const event = JSON.parse(payload) as StripeWebhookEvent;
  if (
    !event ||
    !/^evt_[A-Za-z0-9_]+$/.test(event.id) ||
    typeof event.type !== "string" ||
    !Number.isSafeInteger(event.created) ||
    typeof event.livemode !== "boolean" ||
    !event.data?.object
  )
    throw new Error("INVALID_STRIPE_EVENT");
  return event;
}
