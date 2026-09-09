"use node";
import { action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { createHash } from "node:crypto";
import {
  digest,
  key,
  encrypt,
  decrypt,
  routeProof,
  opaque,
} from "./lib/gmailSecurity";
import { GoogleFailure, tokenRequest, gmailRequest } from "./lib/gmailProvider";
import { messagePreview, sender } from "./lib/gmailMessage";
const proof = v.object({ payload: v.string(), signature: v.string() });
const scope = "https://www.googleapis.com/auth/gmail.readonly";
function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET,
    redirect = process.env.GOOGLE_REDIRECT_URI;
  if (
    !clientId ||
    !clientSecret ||
    !redirect?.startsWith("https://") ||
    !redirect.endsWith("/practice/integrations/gmail/callback")
  )
    throw new Error("GMAIL_NOT_CONFIGURED");
  return {
    clientId,
    clientSecret,
    redirect,
    encryption: key(process.env.GMAIL_TOKEN_ENCRYPTION_KEY),
    signing: key(process.env.GMAIL_ROUTE_SIGNING_KEY),
  };
}
async function safe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    const code =
      error instanceof GoogleFailure
        ? error.code
        : error instanceof Error &&
            ["GMAIL_NOT_CONFIGURED", "INVALID_ROUTE_PROOF"].includes(
              error.message,
            )
          ? error.message
          : "GMAIL_UNAVAILABLE";
    throw new ConvexError(code);
  }
}
function opaqueInput(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new ConvexError("INVALID_OAUTH_STATE");
}
function messageId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(value))
    throw new ConvexError("INVALID_MESSAGE");
}
const aad = (tenantId: string, mailbox: string) =>
  `gmail-refresh:${tenantId}:${mailbox}`;
async function access(
  ctx: ActionCtx,
  tenantId: Id<"tenants">,
): Promise<{ token: string; connection: Doc<"gmailConnections"> }> {
  const { connection } = await ctx.runQuery(internal.gmailInternal.connection, {
    tenantId,
  });
  if (
    connection?.status !== "connected" ||
    !connection.refreshCipher ||
    !connection.mailbox
  )
    throw new ConvexError("RECONNECT_REQUIRED");
  const cfg = config();
  const refresh = decrypt(
    connection.refreshCipher,
    aad(tenantId, connection.mailbox),
    cfg.encryption,
  );
  let token;
  try {
    token = await tokenRequest({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refresh,
    });
  } catch (error) {
    if (error instanceof GoogleFailure && error.code === "RECONNECT_REQUIRED")
      await ctx.runMutation(internal.gmailInternal.disconnect, {
        tenantId,
        generation: connection.generation,
        reauth: true,
      });
    throw error;
  }
  if (typeof token.access_token !== "string")
    throw new GoogleFailure("GMAIL_UNAVAILABLE");
  if (typeof token.refresh_token === "string")
    await ctx.runMutation(internal.gmailInternal.updateToken, {
      tenantId,
      generation: connection.generation,
      refreshCipher: encrypt(
        token.refresh_token,
        aad(tenantId, connection.mailbox),
        cfg.encryption,
      ),
    });
  return { token: token.access_token as string, connection };
}
async function currentRequest(
  ctx: ActionCtx,
  tenantId: Id<"tenants">,
  session: { token: string; connection: Doc<"gmailConnections"> },
  path: string,
) {
  try {
    return await gmailRequest(path, session.token);
  } catch (error) {
    if (error instanceof GoogleFailure && error.code === "RECONNECT_REQUIRED")
      await ctx.runMutation(internal.gmailInternal.disconnect, {
        tenantId,
        generation: session.connection.generation,
        reauth: true,
      });
    throw error;
  }
}
export const beginConnect = action({
  args: {
    tenantId: v.id("tenants"),
    browserBinding: v.string(),
    routeProof: proof,
  },
  handler: (ctx, args) =>
    safe(async () => {
      opaqueInput(args.browserBinding);
      const actor = await ctx.runQuery(internal.gmailInternal.connection, {
        tenantId: args.tenantId,
      });
      const cfg = config(),
        signed = routeProof(args.routeProof, cfg.signing, {
          purpose: "begin",
          userId: actor.subject,
          tenantId: args.tenantId,
          browserBinding: args.browserBinding,
        });
      const state = opaque(),
        verifier = opaque();
      await ctx.runMutation(internal.gmailInternal.begin, {
        tenantId: args.tenantId,
        stateHash: digest(state),
        bindingHash: digest(args.browserBinding),
        sessionHash: digest(signed.sessionId),
        verifierCipher: encrypt(
          verifier,
          `gmail-state:${args.tenantId}:${digest(state)}`,
          cfg.encryption,
        ),
      });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirect,
        response_type: "code",
        scope,
        access_type: "offline",
        prompt: "consent select_account",
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return { authorizationUrl: url.toString(), state };
    }),
});
export const completeConnect = action({
  args: {
    state: v.string(),
    browserBinding: v.string(),
    code: v.string(),
    routeProof: proof,
  },
  handler: (ctx, args): Promise<{ tenantId: Id<"tenants">; mailbox: string }> =>
    safe(async () => {
      opaqueInput(args.state);
      opaqueInput(args.browserBinding);
      if (!args.code || args.code.length > 4096)
        throw new ConvexError("INVALID_OAUTH_STATE");
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new ConvexError("UNAUTHENTICATED");
      const cfg = config(),
        signed = routeProof(args.routeProof, cfg.signing, {
          purpose: "complete",
          userId: identity.subject,
          state: args.state,
          browserBinding: args.browserBinding,
          codeHash: digest(args.code),
        });
      const stateHash = digest(args.state),
        pending = await ctx.runMutation(internal.gmailInternal.consume, {
          stateHash,
          bindingHash: digest(args.browserBinding),
          sessionHash: digest(signed.sessionId),
        });
      const verifier = decrypt(
        pending.verifierCipher,
        `gmail-state:${pending.tenantId}:${stateHash}`,
        cfg.encryption,
      );
      const token = await tokenRequest({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirect,
        grant_type: "authorization_code",
        code: args.code,
        code_verifier: verifier,
      });
      if (
        typeof token.refresh_token !== "string" ||
        typeof token.access_token !== "string" ||
        !String(token.scope ?? "")
          .split(" ")
          .includes(scope)
      )
        throw new ConvexError("RECONNECT_REQUIRED");
      const profile = await gmailRequest("profile", token.access_token);
      if (
        typeof profile.emailAddress !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.emailAddress) ||
        profile.emailAddress.length > 254
      )
        throw new GoogleFailure("GMAIL_UNAVAILABLE");
      const mailbox = profile.emailAddress.toLowerCase();
      return await ctx.runMutation(internal.gmailInternal.finish, {
        stateHash,
        mailbox,
        refreshCipher: encrypt(
          token.refresh_token,
          aad(pending.tenantId, mailbox),
          cfg.encryption,
        ),
      });
    }),
});
export const listMessages = action({
  args: { tenantId: v.id("tenants"), pageToken: v.optional(v.string()) },
  handler: (ctx, args) =>
    safe(async () => {
      if (args.pageToken && args.pageToken.length > 2000)
        throw new ConvexError("INVALID_PAGE_TOKEN");
      const session = await access(ctx, args.tenantId),
        params = new URLSearchParams({
          maxResults: "20",
          labelIds: "INBOX",
          ...(args.pageToken ? { pageToken: args.pageToken } : {}),
        });
      const page = await currentRequest(
        ctx,
        args.tenantId,
        session,
        `messages?${params}`,
      );
      const items = await Promise.all(
        (page.messages ?? []).slice(0, 20).map(async (item: { id: string }) => {
          messageId(item.id);
          const data = await currentRequest(
            ctx,
            args.tenantId,
            session,
            `messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          );
          const preview = messagePreview(data);
          return {
            id: preview.id,
            threadId: preview.threadId,
            from: preview.from,
            subject: preview.subject,
            date: preview.date,
            snippet: preview.snippet,
          };
        }),
      );
      await ctx.runQuery(internal.gmailInternal.assertCurrent, {
        tenantId: args.tenantId,
        generation: session.connection.generation,
      });
      return {
        items,
        ...(page.nextPageToken
          ? { nextPageToken: String(page.nextPageToken) }
          : {}),
      };
    }),
});
export const previewMessage = action({
  args: { tenantId: v.id("tenants"), messageId: v.string() },
  handler: (ctx, args) =>
    safe(async () => {
      messageId(args.messageId);
      const session = await access(ctx, args.tenantId),
        preview = messagePreview(
          await currentRequest(
            ctx,
            args.tenantId,
            session,
            `messages/${args.messageId}?format=full`,
          ),
        );
      if (preview.id !== args.messageId)
        throw new GoogleFailure("GMAIL_UNAVAILABLE");
      await ctx.runQuery(internal.gmailInternal.assertCurrent, {
        tenantId: args.tenantId,
        generation: session.connection.generation,
      });
      return preview;
    }),
});
export const importMessage = action({
  args: { tenantId: v.id("tenants"), messageId: v.string() },
  handler: (
    ctx,
    args,
  ): Promise<{ enquiryId: Id<"enquiries">; alreadyImported: boolean }> =>
    safe(async () => {
      messageId(args.messageId);
      const session = await access(ctx, args.tenantId),
        preview = messagePreview(
          await currentRequest(
            ctx,
            args.tenantId,
            session,
            `messages/${args.messageId}?format=full`,
          ),
        );
      if (preview.id !== args.messageId)
        throw new GoogleFailure("GMAIL_UNAVAILABLE");
      if (!preview.plainTextAvailable) throw new ConvexError("NO_PLAIN_TEXT");
      return await ctx.runMutation(internal.gmailInternal.importMessage, {
        tenantId: args.tenantId,
        generation: session.connection.generation,
        mailbox: session.connection.mailbox!,
        messageId: preview.id,
        threadId: preview.threadId,
        ...sender(preview.from),
        subject: preview.subject,
        message: preview.text,
        truncated: preview.bodyTruncated,
      });
    }),
});
export const disconnect = action({
  args: { tenantId: v.id("tenants") },
  handler: (ctx, args) =>
    safe(async () => {
      const { connection } = await ctx.runQuery(
        internal.gmailInternal.connection,
        args,
      );
      await ctx.runMutation(internal.gmailInternal.disconnect, {
        ...args,
        ...(connection ? { generation: connection.generation } : {}),
      });
      let providerRevoked = false;
      if (connection?.refreshCipher && connection.mailbox) {
        try {
          const refresh = decrypt(
            connection.refreshCipher,
            aad(args.tenantId, connection.mailbox),
            config().encryption,
          );
          const result = await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: refresh }).toString(),
            signal: AbortSignal.timeout(15000),
          });
          providerRevoked = result.ok;
        } catch {
          /* Local access has already been revoked. */
        }
      }
      return { disconnected: true, providerRevoked };
    }),
});
