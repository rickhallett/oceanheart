import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = process.argv[2];
if (!outputDirectory) {
  throw new Error("Usage: node scripts/check-therapy-draft.mjs <hugo-output>");
}

const therapyHtml = await readFile(
  path.join(outputDirectory, "therapy", "index.html"),
  "utf8",
);
const homeHtml = await readFile(
  path.join(outputDirectory, "index.html"),
  "utf8",
);

assert.match(
  therapyHtml,
  /<meta name="robots" content="noindex,nofollow,noarchive">/,
);
assert.match(therapyHtml, /Oceanheart private therapy/);
assert.match(therapyHtml, /This page does not collect health information/);
assert.doesNotMatch(therapyHtml, /posthog/i);
assert.doesNotMatch(therapyHtml, /fonts\.googleapis\.com/i);
assert.doesNotMatch(therapyHtml, /fonts\.gstatic\.com/i);
assert.doesNotMatch(therapyHtml, /adventure\.js/i);
assert.doesNotMatch(therapyHtml, /github\.com/i);
assert.doesNotMatch(therapyHtml, /<form/i);

assert.match(homeHtml, /posthog/i);
assert.match(homeHtml, /fonts\.googleapis\.com/i);

process.stdout.write(
  "Verified draft therapy route isolation and retained normal-site assets.\n",
);
