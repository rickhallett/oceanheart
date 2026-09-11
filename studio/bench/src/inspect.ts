import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Read existing local run metadata without creating or mutating a state directory. */
export function inspectRuns(root: string, clientId: string) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(clientId)) throw new Error("INVALID_CLIENT_ID");
  const file = join(root, "jobs.sqlite");
  if (!existsSync(file)) return { clientId, state: "not_initialized", runs: [] };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare("SELECT json FROM jobs WHERE client = ? ORDER BY rowid DESC LIMIT 100").all(clientId);
    return {
      clientId,
      state: "local",
      limit: 100,
      runs: rows.map((row) => {
        const job = JSON.parse(String(row.json));
        return {
          runId: job.id,
          status: job.status,
          toolCalls: job.toolCalls,
          turns: job.turns,
          draftId: job.result?.draftId,
          totalMinor: job.result?.totalMinor,
          currency: job.result?.currency,
        };
      }),
    };
  } finally {
    db.close();
  }
}
