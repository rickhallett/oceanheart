/** Bounded lexical retrieval. Offsets are half-open JavaScript UTF-16 positions. */
export type Passage = {
  sourceId: string;
  versionId: string;
  hash: string;
  start: number;
  end: number;
  text: string;
};
export type SearchSource = {
  sourceId: string;
  versionId: string;
  hash: string;
  content: string;
};
const stop = new Set(
  "a an and are as at be by can do does for from how i in is it of on or our should the their this to was we what when where which who with you your".split(
    " ",
  ),
);
export function terms(text: string) {
  return [
    ...new Set(
      (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
        (t) => t.length > 1 && !stop.has(t),
      ),
    ),
  ];
}
export function retrieve(question: string, sources: SearchSource[]): Passage[] {
  const query = terms(question);
  if (!query.length) return [];
  const candidates: (Passage & { score: number })[] = [];
  for (const source of sources) {
    // Paragraph boundaries preserve exact spans; long paragraphs use bounded windows.
    for (const match of source.content.matchAll(/[^\r\n]+/g)) {
      for (let offset = 0; offset < match[0].length; offset += 600) {
        const start = match.index! + offset,
          text = match[0].slice(offset, offset + 600);
        const words = new Set(terms(text));
        const hits = query.filter((t) => words.has(t)).length;
        if (hits < Math.min(2, query.length) || hits / query.length < 0.5)
          continue;
        candidates.push({
          sourceId: source.sourceId,
          versionId: source.versionId,
          hash: source.hash,
          start,
          end: start + text.length,
          text,
          score: hits / query.length,
        });
      }
    }
  }
  return candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.sourceId.localeCompare(b.sourceId) ||
        a.start - b.start,
    )
    .slice(0, 8)
    .map(({ score, ...p }) => p);
}
export type Selection = { status: "answer" | "abstain"; passages: number[] };
export function checkedSelection(value: unknown, count: number): Selection {
  if (!value || typeof value !== "object") throw Error("INVALID_ANSWER");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join(",") !== "passages,status" ||
    !["answer", "abstain"].includes(String(v.status)) ||
    !Array.isArray(v.passages) ||
    v.passages.length > 4 ||
    v.passages.some((n) => !Number.isInteger(n) || n < 0 || n >= count) ||
    new Set(v.passages).size !== v.passages.length ||
    (v.status === "answer") !== !!v.passages.length
  )
    throw Error("INVALID_ANSWER");
  return v as Selection;
}
