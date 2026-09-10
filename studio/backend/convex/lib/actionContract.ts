import { v } from "convex/values";
export const proposalTask = v.object({
  title: v.string(),
  dueDate: v.optional(v.string()),
});
export const proposalReference = v.object({
  sourceId: v.id("knowledgeSources"),
  versionId: v.id("knowledgeVersions"),
  hash: v.string(),
});
export const proposalEvidence = v.object({
  sourceId: v.id("knowledgeSources"),
  versionId: v.id("knowledgeVersions"),
  hash: v.string(),
  start: v.number(),
  end: v.number(),
});
export const PROPOSAL_LIFETIME_MS = 10 * 60 * 1000;
