import { createHash } from "node:crypto";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextRequest, NextResponse } from "next/server";
import {
  bridgeRequestFor,
  parseClaraBridgeResponse,
  parseClaraBrowserRequest,
} from "@/lib/clara-contract";
import { claraInstanceConfig } from "@/lib/clara-instance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestLimit = 4 * 1024;
const responseLimit = 128 * 1024;

function json(value: unknown, status = 200) {
  const response = NextResponse.json(value, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

async function boundedText(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  errorCode: string,
) {
  if (!body) throw new Error(errorCode);
  const reader = body.getReader(),
    chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new Error(errorCode);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function boundedBody(response: Response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > responseLimit)
    throw new Error("BRIDGE_RESPONSE_TOO_LARGE");
  return JSON.parse(
    await boundedText(
      response.body,
      responseLimit,
      "BRIDGE_RESPONSE_TOO_LARGE",
    ),
  );
}

export async function POST(request: NextRequest) {
  const config = claraInstanceConfig();
  if (!config) return json({ error: "Not available" }, 404);
  if (request.headers.get("origin") !== config.origin)
    return json({ error: "Request denied" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json")
    return json({ error: "Request invalid" }, 400);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > requestLimit)
    return json({ error: "Request invalid" }, 400);
  try {
    const auth = await withAuth();
    if (!auth.user || !auth.sessionId || !auth.accessToken)
      return json({ error: "Sign in again" }, 401);
    let body: string;
    try {
      body = await boundedText(request.body, requestLimit, "REQUEST_TOO_LARGE");
    } catch {
      return json({ error: "Request invalid" }, 400);
    }
    let browserRequest;
    try {
      browserRequest = parseClaraBrowserRequest(JSON.parse(body));
    } catch {
      return json({ error: "Request invalid" }, 400);
    }
    const actorKey = `${createHash("sha256").update(auth.user.id).digest("hex").slice(0, 24)}-clara-v1`;
    const bridgeResponse = await fetch(config.runtimeUrl, {
      method: "POST",
      redirect: "error",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${auth.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(bridgeRequestFor(browserRequest, actorKey)),
      signal: AbortSignal.timeout(35_000),
      cache: "no-store",
    });
    if (bridgeResponse.status === 401 || bridgeResponse.status === 403)
      return json({ error: "Request denied" }, 403);
    if (!bridgeResponse.ok)
      return json({ error: "Service unavailable" }, 503);
    return json(
      parseClaraBridgeResponse(
        browserRequest,
        await boundedBody(bridgeResponse),
      ),
    );
  } catch {
    return json({ error: "Service unavailable" }, 503);
  }
}
