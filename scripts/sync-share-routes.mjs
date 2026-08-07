#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const blogDirectory = join(repoRoot, "content", "blog");
const configPath = join(repoRoot, "vercel.json");
const modes = new Set(process.argv.slice(2));

if (
  modes.size !== 1 ||
  !["--check", "--list", "--write"].some((mode) => modes.has(mode))
) {
  console.error(
    "Usage: node scripts/sync-share-routes.mjs --check|--list|--write",
  );
  process.exit(2);
}

function fail(message) {
  throw new Error(message);
}

function parseQuotedString(rawValue, label) {
  const value = rawValue.trim();
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "string") {
        fail(`${label} must be a string`);
      }
      return parsed;
    } catch (error) {
      fail(`${label} is not a valid double-quoted string: ${error.message}`);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  fail(`${label} must use a quoted string`);
}

function parseStringArray(rawValue, label) {
  try {
    const parsed = JSON.parse(rawValue);
    if (
      !Array.isArray(parsed) ||
      parsed.some((value) => typeof value !== "string")
    ) {
      fail(`${label} must be an array of strings`);
    }
    return parsed;
  } catch (error) {
    fail(
      `${label} must be a single-line, double-quoted TOML array: ${error.message}`,
    );
  }
}

function parseFrontMatter(filePath) {
  const text = readFileSync(filePath, "utf8");
  const match = text.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+(?:\r?\n|$)/);
  if (!match) {
    fail(`${filePath} does not contain TOML frontmatter`);
  }

  const values = {
    aliases: [],
    build: {},
    draft: undefined,
    slug: undefined,
    url: undefined,
  };
  let section = "";

  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!assignment) {
      continue;
    }

    const [, key, rawValue] = assignment;
    const label = `${basename(filePath)}:${key}`;

    if (section === "" && key === "aliases") {
      values.aliases = parseStringArray(rawValue, label);
    } else if (section === "" && key === "draft") {
      if (rawValue === "true") {
        values.draft = true;
      } else if (rawValue === "false") {
        values.draft = false;
      } else {
        fail(`${label} must be true or false`);
      }
    } else if (section === "" && (key === "slug" || key === "url")) {
      values[key] = parseQuotedString(rawValue, label);
    } else if (
      section === "build" &&
      (key === "list" || key === "render")
    ) {
      values.build[key] = parseQuotedString(rawValue, label);
    }
  }

  return values;
}

function normalizeAlias(rawAlias, fileName) {
  const value = rawAlias.trim();
  if (!value.startsWith("/")) {
    fail(`${fileName} alias "${rawAlias}" must be site-relative`);
  }
  if (value.includes("?") || value.includes("#")) {
    fail(`${fileName} alias "${rawAlias}" cannot contain a query or fragment`);
  }

  const segments = value.split("/").filter(Boolean);
  if (
    segments.length !== 1 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segments[0])
  ) {
    fail(
      `${fileName} alias "${rawAlias}" must be one lowercase root path segment`,
    );
  }

  return `/${segments[0]}/`;
}

function normalizeDestination(rawDestination, fileName) {
  let destination = rawDestination.trim();
  if (!destination.startsWith("/")) {
    destination = `/${destination}`;
  }
  if (!destination.endsWith("/")) {
    destination = `${destination}/`;
  }
  if (destination.includes("?") || destination.includes("#")) {
    fail(`${fileName} canonical destination cannot contain a query or fragment`);
  }
  return destination.replace(/\/{2,}/g, "/");
}

function collectReservedRootPaths() {
  const reserved = new Set(["404", "blog", "index"]);
  const roots = [
    { directory: join(repoRoot, "content"), skip: new Set(["blog"]) },
    { directory: join(repoRoot, "static"), skip: new Set() },
  ];

  for (const { directory, skip } of roots) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (skip.has(entry.name)) {
        continue;
      }
      const extension = extname(entry.name);
      reserved.add(extension ? basename(entry.name, extension) : entry.name);
    }
  }

  return reserved;
}

function collectShareRoutes() {
  const reserved = collectReservedRootPaths();
  const aliases = new Map();
  const articles = [];

  for (const entry of readdirSync(blogDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "_index.md") {
      continue;
    }

    const filePath = join(blogDirectory, entry.name);
    const frontMatter = parseFrontMatter(filePath);
    const isPublished =
      frontMatter.draft !== true && frontMatter.build.render === "always";

    if (!isPublished) {
      continue;
    }

    if (frontMatter.aliases.length === 0) {
      fail(
        `${entry.name} is publicly rendered but has no share-friendly alias`,
      );
    }

    const stem = basename(entry.name, ".md");
    const destination = normalizeDestination(
      frontMatter.url ??
        `/blog/${frontMatter.slug ?? stem}/`,
      entry.name,
    );
    const articleAliases = [];

    for (const rawAlias of frontMatter.aliases) {
      const alias = normalizeAlias(rawAlias, entry.name);
      const aliasKey = alias.slice(1, -1);

      if (reserved.has(aliasKey)) {
        fail(`${entry.name} alias "${alias}" collides with an existing root route`);
      }
      if (aliases.has(alias)) {
        fail(
          `${entry.name} alias "${alias}" is already owned by ${aliases.get(alias)}`,
        );
      }

      aliases.set(alias, entry.name);
      articleAliases.push(alias);
    }

    articles.push({
      aliases: articleAliases.sort(),
      destination,
      fileName: entry.name,
    });
  }

  articles.sort((left, right) => left.destination.localeCompare(right.destination));

  const redirects = articles
    .flatMap((article) =>
      article.aliases.flatMap((alias) => [
        {
          source: alias.slice(0, -1),
          destination: article.destination,
          permanent: true,
        },
        {
          source: alias,
          destination: article.destination,
          permanent: true,
        },
      ]),
    )
    .sort((left, right) => left.source.localeCompare(right.source));

  return { articles, redirects };
}

function isManagedBlogRedirect(route) {
  return (
    route &&
    typeof route.destination === "string" &&
    route.destination.startsWith("/blog/")
  );
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

try {
  if (!existsSync(configPath)) {
    fail("vercel.json is missing");
  }

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const { articles, redirects } = collectShareRoutes();

  if (modes.has("--list")) {
    for (const article of articles) {
      for (const alias of article.aliases) {
        console.log(`${alias}\t${article.destination}`);
      }
    }
    process.exit(0);
  }

  const currentRedirects = Array.isArray(config.redirects)
    ? config.redirects
    : [];
  const manualRedirects = currentRedirects.filter(
    (route) => !isManagedBlogRedirect(route),
  );
  const currentManagedRedirects = currentRedirects.filter(isManagedBlogRedirect);

  const manualSources = new Set(manualRedirects.map((route) => route.source));
  for (const route of redirects) {
    if (manualSources.has(route.source)) {
      fail(`Generated source "${route.source}" collides with a manual redirect`);
    }
  }

  if (modes.has("--check")) {
    if (!sameJson(currentManagedRedirects, redirects)) {
      console.error(
        "Share routes are stale. Run node scripts/sync-share-routes.mjs --write",
      );
      process.exit(1);
    }
    console.log(
      `Share routes are current: ${articles.length} articles, ${redirects.length} redirects.`,
    );
    process.exit(0);
  }

  config.redirects = [...manualRedirects, ...redirects];
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(
    `Updated ${configPath}: ${articles.length} articles, ${redirects.length} redirects.`,
  );
} catch (error) {
  console.error(`Share route sync failed: ${error.message}`);
  process.exit(1);
}
