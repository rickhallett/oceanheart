import { ConvexError, v } from "convex/values";
import {
  action,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireKnowledgeAccess } from "./lib/knowledgeAccess";
import { retrieve, type Passage } from "./lib/retrieval";
import { providerConfig, selectEvidence } from "./lib/answerProvider";

const selectionArgs = {
  tenantId: v.id("tenants"),
  sourceIds: v.array(v.id("knowledgeSources")),
  question: v.string(),
};
const reference = v.object({
  sourceId: v.id("knowledgeSources"),
  versionId: v.id("knowledgeVersions"),
  hash: v.string(),
});
const citation = v.object({
  sourceId: v.id("knowledgeSources"),
  versionId: v.id("knowledgeVersions"),
  hash: v.string(),
  start: v.number(),
  end: v.number(),
});
type Reference = {
  sourceId: Id<"knowledgeSources">;
  versionId: Id<"knowledgeVersions">;
  hash: string;
};
type Citation = Reference & { start: number; end: number };
async function eligible(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  sourceIds: Id<"knowledgeSources">[],
) {
  await requireKnowledgeAccess(ctx, tenantId, "read");
  if (
    !sourceIds.length ||
    sourceIds.length > 5 ||
    new Set(sourceIds).size !== sourceIds.length
  )
    throw new ConvexError("INVALID_SELECTION");
  return Promise.all(
    sourceIds.map(async (sourceId) => {
      const source = await ctx.db.get(sourceId);
      if (!source || source.tenantId !== tenantId)
        throw new ConvexError("FORBIDDEN");
      if (
        source.archived || source.deletedAt !== undefined ||
        source.audience !== "owner" ||
        !source.currentVersionId ||
        source.approvedVersionId !== source.currentVersionId
      )
        throw new ConvexError("SOURCE_UNAVAILABLE");
      const version = await ctx.db.get(source.currentVersionId);
      if (
        !version ||
        version.tenantId !== tenantId ||
        version.sourceId !== sourceId ||
        new TextEncoder().encode(version.content).length > 32768
      )
        throw new ConvexError("SOURCE_UNAVAILABLE");
      return {
        sourceId,
        versionId: version._id,
        hash: version.hash,
        title: version.title,
        provenance: version.provenance,
        number: version.number,
        content: version.content,
      };
    }),
  );
}
async function snapshot(
  ctx: QueryCtx,
  args: {
    tenantId: Id<"tenants">;
    sourceIds: Id<"knowledgeSources">[];
    question: string;
  },
) {
  const sources = await eligible(ctx, args.tenantId, args.sourceIds);
  if (!args.question.trim() || args.question.length > 400)
    throw new ConvexError("INVALID_QUESTION");
  return {
    references: sources.map(({ sourceId, versionId, hash }) => ({
      sourceId,
      versionId,
      hash,
    })),
    passages: retrieve(args.question, sources),
  };
}
export async function resolveCurrent(
  ctx: QueryCtx,
  args: {
    tenantId: Id<"tenants">;
    references: Reference[];
    citations: Citation[];
  },
) {
  const sources = await eligible(
    ctx,
    args.tenantId,
    args.references.map((r) => r.sourceId),
  );
  if (args.citations.length > 8) throw new ConvexError("INVALID_CITATION");
  if (
    sources.some(
      (s, i) =>
        s.versionId !== args.references[i].versionId ||
        s.hash !== args.references[i].hash,
    )
  )
    throw new ConvexError("SOURCE_UNAVAILABLE");
  return args.citations.map((c) => {
    const source = sources.find(
      (s) =>
        s.sourceId === c.sourceId &&
        s.versionId === c.versionId &&
        s.hash === c.hash,
    );
    if (
      !source ||
      !Number.isInteger(c.start) ||
      !Number.isInteger(c.end) ||
      c.start < 0 ||
      c.end <= c.start ||
      c.end > source.content.length ||
      c.end - c.start > 600
    )
      throw new ConvexError("INVALID_CITATION");
    return {
      ...c,
      title: source.title,
      provenance: source.provenance,
      number: source.number,
      text: source.content.slice(c.start, c.end),
    };
  });
}
export const search = query({ args: selectionArgs, handler: snapshot });
export const prepare = internalQuery({
  args: selectionArgs,
  handler: snapshot,
});
const resolveArgs = {
  tenantId: v.id("tenants"),
  references: v.array(reference),
  citations: v.array(citation),
};
export const resolve = query({ args: resolveArgs, handler: resolveCurrent });
export const revalidate = internalQuery({
  args: resolveArgs,
  handler: resolveCurrent,
});
export const availability = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireKnowledgeAccess(ctx, args.tenantId, "read");
    return { enabled: providerConfig(process.env)?.tenantId === args.tenantId };
  },
});
export type AnswerResult = {
  status: "answer" | "abstain";
  references: Reference[];
  citations: Citation[];
  elapsedMs: number;
  usage: { model: string; inputTokens: number; outputTokens: number } | null;
};
function ref(p: Passage): Citation {
  return {
    sourceId: p.sourceId as Id<"knowledgeSources">,
    versionId: p.versionId as Id<"knowledgeVersions">,
    hash: p.hash,
    start: p.start,
    end: p.end,
  };
}
export const ask = action({
  args: selectionArgs,
  handler: async (ctx, args): Promise<AnswerResult> => {
    const started = Date.now();
    const prepared: { references: Reference[]; passages: Passage[] } =
      await ctx.runQuery(internal.citedAnswers.prepare, args);
    const config = providerConfig(process.env);
    if (!config || config.tenantId !== args.tenantId)
      throw new ConvexError("PROVIDER_NOT_CONFIGURED");
    if (!prepared.passages.length)
      return {
        status: "abstain",
        references: prepared.references,
        citations: [],
        elapsedMs: Date.now() - started,
        usage: null,
      };
    let result: Awaited<ReturnType<typeof selectEvidence>>;
    try {
      result = await selectEvidence(config, args.question, prepared.passages);
    } catch {
      throw new ConvexError("ANSWER_UNAVAILABLE");
    }
    const citations = result.selection.passages.map((i) =>
      ref(prepared.passages[i]),
    );
    // Re-read owner role and every selected version after the external await.
    await ctx.runQuery(internal.citedAnswers.revalidate, {
      tenantId: args.tenantId,
      references: prepared.references,
      citations,
    });
    return {
      status: result.selection.status,
      references: prepared.references,
      citations,
      elapsedMs: Date.now() - started,
      usage: {
        model: config.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    };
  },
});
