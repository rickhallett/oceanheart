import {
  createLocalJWKSet,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from "jose";

import type { IdentityVerifier, VerifiedPrincipal } from "./binding.ts";

export interface JwksNetworkAdapter {
  fetch(url: URL, signal: AbortSignal): Promise<unknown>;
}

export interface WorkOsSessionStatusAdapter {
  isActive(input: {
    sessionId: string;
    subject: string;
    environmentId: string;
    signal: AbortSignal;
  }): Promise<boolean>;
}

export class HttpsJwksNetworkAdapter implements JwksNetworkAdapter {
  private readonly maxBytes: number;

  constructor(maxBytes = 256 * 1024) {
    this.maxBytes = maxBytes;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 1024 * 1024)
      throw new Error("JWKS_RESPONSE_LIMIT_INVALID");
  }

  async fetch(url: URL, signal: AbortSignal) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error("JWKS_FETCH_FAILED");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > this.maxBytes) throw new Error("JWKS_RESPONSE_TOO_LARGE");
    if (!response.body) throw new Error("JWKS_RESPONSE_INVALID");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > this.maxBytes) {
        await reader.cancel();
        throw new Error("JWKS_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    try { return JSON.parse(text) as unknown; }
    catch { throw new Error("JWKS_RESPONSE_INVALID"); }
  }
}

type WorkOsClaims = JWTPayload & { sid?: unknown; client_id?: unknown };
export type WorkOsVerificationCode =
  | "POLICY_MISMATCH"
  | "AUTHORIZATION_INVALID"
  | "TOKEN_HEADER_INVALID"
  | "TOKEN_VERIFICATION_FAILED"
  | "SUBJECT_INVALID"
  | "SESSION_ID_INVALID"
  | "CLIENT_ID_MISMATCH"
  | "AUDIENCE_MISMATCH"
  | "EXPIRY_INVALID"
  | "SESSION_INACTIVE";

const environmentId = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,255}$/;
const audience = /^client_[A-Za-z0-9]{8,127}$/;
const subject = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,255}$/;
const keyId = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,255}$/;
const bearer = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

function httpsUrl(value: string, label: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${label}_INVALID`); }
  const authority = url.href.slice(`${url.protocol}//`.length).split("/", 1)[0] ?? "";
  if (url.protocol !== "https:" || authority.includes("@") || url.search || url.hash)
    throw new Error(`${label}_INVALID`);
  return url;
}

function publicRsaJwks(value: unknown): JSONWebKeySet {
  if (!value || typeof value !== "object" || !Array.isArray((value as { keys?: unknown }).keys))
    throw new Error("JWKS_INVALID");
  const keys = (value as { keys: unknown[] }).keys;
  if (!keys.length || keys.length > 20) throw new Error("JWKS_INVALID");
  const keyIds = new Set<string>();
  for (const entry of keys) {
    if (!entry || typeof entry !== "object") throw new Error("JWKS_INVALID");
    const key = entry as Record<string, unknown>;
    const kid = String(key.kid ?? "");
    if (
      key.kty !== "RSA" || !keyId.test(kid) || keyIds.has(kid) ||
      (key.alg !== undefined && key.alg !== "RS256") ||
      (key.use !== undefined && key.use !== "sig") ||
      ["d", "p", "q", "dp", "dq", "qi", "k"].some((name) => key[name] !== undefined)
    ) throw new Error("JWKS_INVALID");
    keyIds.add(kid);
  }
  return structuredClone(value) as JSONWebKeySet;
}

async function bounded<T>(timeoutMs: number, operation: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("VERIFICATION_TIMEOUT")), { once: true })),
    ]);
  } finally { clearTimeout(timeout); }
}

export class WorkOsJwtIdentityVerifier implements IdentityVerifier {
  readonly provider = "workos" as const;
  private readonly environmentId: string;
  private readonly audience: string;
  private readonly issuer: string;
  private readonly jwksUrl: URL;
  private readonly network: JwksNetworkAdapter;
  private readonly sessionStatus?: WorkOsSessionStatusAdapter;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly diagnostic?: (code: WorkOsVerificationCode) => void;
  private cache?: { jwks: JSONWebKeySet; expiresAt: number };
  private loading?: Promise<JSONWebKeySet>;

  constructor(input: {
    environmentId: string;
    audience: string;
    issuer: string;
    jwksUrl: string;
    network?: JwksNetworkAdapter;
    sessionStatus?: WorkOsSessionStatusAdapter;
    timeoutMs?: number;
    cacheTtlMs?: number;
    diagnostic?: (code: WorkOsVerificationCode) => void;
  }) {
    if (!environmentId.test(input.environmentId)) throw new Error("WORKOS_ENVIRONMENT_INVALID");
    if (!audience.test(input.audience)) throw new Error("WORKOS_AUDIENCE_INVALID");
    this.environmentId = input.environmentId;
    this.audience = input.audience;
    if (input.issuer !== "https://api.workos.com/") throw new Error("WORKOS_ISSUER_INVALID");
    this.issuer = input.issuer;
    this.jwksUrl = httpsUrl(input.jwksUrl, "WORKOS_JWKS_URL");
    if (this.jwksUrl.href !== `https://api.workos.com/sso/jwks/${this.audience}`)
      throw new Error("WORKOS_JWKS_URL_INVALID");
    this.network = input.network ?? new HttpsJwksNetworkAdapter();
    this.sessionStatus = input.sessionStatus;
    this.timeoutMs = input.timeoutMs ?? 3_000;
    this.cacheTtlMs = input.cacheTtlMs ?? 5 * 60_000;
    this.diagnostic = input.diagnostic;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 50 || this.timeoutMs > 10_000)
      throw new Error("WORKOS_TIMEOUT_INVALID");
    if (!Number.isSafeInteger(this.cacheTtlMs) || this.cacheTtlMs < 1_000 || this.cacheTtlMs > 60 * 60_000)
      throw new Error("WORKOS_JWKS_CACHE_INVALID");
  }

  private async keys(force: boolean) {
    if (!force && this.cache && this.cache.expiresAt > Date.now()) return this.cache.jwks;
    if (!force && this.loading) return this.loading;
    const load = bounded(this.timeoutMs, (signal) => this.network.fetch(this.jwksUrl, signal))
      .then(publicRsaJwks)
      .then((jwks) => {
        this.cache = { jwks, expiresAt: Date.now() + this.cacheTtlMs };
        return jwks;
      });
    if (!force) this.loading = load;
    try { return await load; }
    finally { if (this.loading === load) this.loading = undefined; }
  }

  private async verifyJwt(token: string) {
    const header = decodeProtectedHeader(token);
    if (
      header.alg !== "RS256" || !keyId.test(String(header.kid ?? "")) ||
      (header.typ !== undefined && header.typ !== "JWT" && header.typ !== "at+jwt")
    ) throw new Error("WORKOS_TOKEN_HEADER_INVALID");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await jwtVerify<WorkOsClaims>(token, createLocalJWKSet(await this.keys(attempt === 1)), {
          algorithms: ["RS256"],
          issuer: ["https://api.workos.com", "https://api.workos.com/"],
          clockTolerance: 5,
        });
      } catch (error) {
        if (attempt === 0 && error instanceof errors.JWKSNoMatchingKey) continue;
        throw error;
      }
    }
    throw new Error("WORKOS_TOKEN_INVALID");
  }

  private diagnosticCode(error: unknown): WorkOsVerificationCode {
    const message = error instanceof Error ? error.message : "";
    if (message === "WORKOS_POLICY_MISMATCH") return "POLICY_MISMATCH";
    if (message === "WORKOS_AUTHORIZATION_INVALID") return "AUTHORIZATION_INVALID";
    if (message === "WORKOS_TOKEN_HEADER_INVALID") return "TOKEN_HEADER_INVALID";
    if (message === "WORKOS_TOKEN_SUBJECT_INVALID") return "SUBJECT_INVALID";
    if (message === "WORKOS_TOKEN_SESSION_INVALID") return "SESSION_ID_INVALID";
    if (message === "WORKOS_TOKEN_CLIENT_INVALID") return "CLIENT_ID_MISMATCH";
    if (message === "WORKOS_TOKEN_AUDIENCE_INVALID") return "AUDIENCE_MISMATCH";
    if (message === "WORKOS_TOKEN_EXPIRY_INVALID") return "EXPIRY_INVALID";
    if (message === "WORKOS_SESSION_INACTIVE") return "SESSION_INACTIVE";
    return "TOKEN_VERIFICATION_FAILED";
  }

  async verify(input: {
    authorization: string | undefined;
    environmentId: string;
    audience: string;
    issuer: string;
  }): Promise<VerifiedPrincipal> {
    try {
      if (
        input.environmentId !== this.environmentId || input.audience !== this.audience ||
        input.issuer !== this.issuer || !input.authorization || input.authorization.length > 16 * 1024
      ) throw new Error("WORKOS_POLICY_MISMATCH");
      const match = bearer.exec(input.authorization);
      if (!match) throw new Error("WORKOS_AUTHORIZATION_INVALID");
      const { payload } = await this.verifyJwt(match[1]!);
      if (!subject.test(String(payload.sub ?? ""))) throw new Error("WORKOS_TOKEN_SUBJECT_INVALID");
      if (!subject.test(String(payload.sid ?? ""))) throw new Error("WORKOS_TOKEN_SESSION_INVALID");
      if (payload.client_id !== this.audience) throw new Error("WORKOS_TOKEN_CLIENT_INVALID");
      if (payload.aud !== undefined && payload.aud !== this.audience)
        throw new Error("WORKOS_TOKEN_AUDIENCE_INVALID");
      if (!Number.isSafeInteger(payload.exp)) throw new Error("WORKOS_TOKEN_EXPIRY_INVALID");
      if (this.sessionStatus) {
        const active = await bounded(this.timeoutMs, (signal) => this.sessionStatus!.isActive({
          sessionId: String(payload.sid),
          subject: String(payload.sub),
          environmentId: this.environmentId,
          signal,
        }));
        if (!active) throw new Error("WORKOS_SESSION_INACTIVE");
      }
      return {
        provider: "workos",
        subject: String(payload.sub),
        environmentId: this.environmentId,
        audience: this.audience,
        issuer: this.issuer,
      };
    } catch (error) {
      try { this.diagnostic?.(this.diagnosticCode(error)); } catch { /* diagnostic sinks cannot alter auth */ }
      throw error;
    }
  }
}
