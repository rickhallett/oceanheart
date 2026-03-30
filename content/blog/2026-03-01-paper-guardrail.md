+++
title = "Build your house from paper and 0.37% of the time you'll get screwed 100% of the time"
date = "2026-03-01T15:00:00Z"
description = "A standing order said 'read the file.' The file was 33,700 tokens. So we wrote 60 lines of JavaScript."
tags = ["agents", "tokens", "discipline", "slopodar"]
draft = false
+++

```js
import { readFileSync, writeFileSync } from 'fs';

const SD_FILE = 'docs/internal/session-decisions.md';
const INDEX_FILE = 'docs/internal/session-decisions-index.yaml';

const content = readFileSync(SD_FILE, 'utf-8');
const lines = content.split('\n');

const sdRows = [];
for (const line of lines) {
  const match = line.match(
    /^\|\s*SD-(\d+)\s*\|\s*\[([^\]]+)\]\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
  );
  if (match) {
    sdRows.push({
      id: parseInt(match[1]),
      label: match[2],
      summary: match[3].slice(0, 200).replace(/\*\*/g, '').trim(),
      author: match[4].trim(),
      status: match[5].trim(),
    });
  }
}

const total = sdRows.length;
const latest = sdRows.slice(-20);
const first = sdRows[0];
const last = sdRows[sdRows.length - 1];

const yaml = `# session-decisions-index.yaml
# Auto-generated — do not edit manually
# Full file: ${SD_FILE} (${total} entries, append-only)
#
# This is the BOOT file. Read this, not the full log.

generated: "${new Date().toISOString()}"
total_decisions: ${total}
range: "SD-${first?.id} to SD-${last?.id}"

recent:
${latest.map(sd => `  - id: SD-${sd.id}
    label: "${sd.label}"
    summary: "${sd.summary.replace(/"/g, '\\"')}"
    status: "${sd.status}"`).join('\n')}
`;

writeFileSync(INDEX_FILE, yaml);
```

[Source](https://github.com/rickhallett/thepit/blob/wake/bin/sd-index.js)[^1]

[^1]: [Paper Guardrail](https://github.com/rickhallett/thepit/blob/wake/slopodar.yaml#L201) — "The LLM creates a rule, then in the same breath asserts that the rule will prevent the failure it was designed for. The assertion has no enforcement mechanism." ([oceanheart.ai/slopodar/paper-guardrail](https://oceanheart.ai/slopodar/paper-guardrail/))
