import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://www.oceanheart.ai";
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = path.join(repositoryRoot, "public");

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `missing rendered file: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function attribute(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? (match[1] ?? match[2]) : null;
}

function hasAttribute(tag, name) {
  return new RegExp(`\\b${name}(?=\\s|=|/?>)`, "i").test(tag);
}

function openingTags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function allOpeningTags(html) {
  return html.match(/<[a-z][a-z0-9:-]*\b[^>]*>/gi) ?? [];
}

function elements(html, name) {
  return [
    ...html.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "gi")),
  ];
}

function visibleText(markup) {
  return markup
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, " ")
    .trim();
}

function containsLetterOrNumber(markup) {
  return /[\p{L}\p{N}]/u.test(visibleText(markup));
}

function containsMeaningfulContent(markup) {
  return (
    containsLetterOrNumber(markup) ||
    /<(?:img|svg|video|audio|canvas|iframe)\b/i.test(markup)
  );
}

function onlyTag(html, name, key, value, route) {
  const matches = openingTags(html, name).filter(
    (tag) => attribute(tag, key) === value,
  );
  assert.equal(
    matches.length,
    1,
    `${route} must contain exactly one ${name}[${key}="${value}"]`,
  );
  return matches[0];
}

function htmlPathFor(url) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, SITE_ORIGIN, `${url} uses the wrong site origin`);
  assert.equal(parsed.search, "", `${url} contains a query string`);
  assert.equal(parsed.hash, "", `${url} contains a fragment`);
  const relativePath = decodeURIComponent(parsed.pathname).replace(/^\//, "");
  return path.join(outputDirectory, relativePath, "index.html");
}

function shortList(values) {
  const shown = values.slice(0, 10);
  const suffix = values.length > shown.length ? ` and ${values.length - shown.length} more` : "";
  return `${shown.join(", ")}${suffix}`;
}

function assertSameRoutes(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((route) => !actualSet.has(route));
  const extra = actual.filter((route) => !expectedSet.has(route));

  assert.equal(
    missing.length + extra.length,
    0,
    `${label}; missing: ${shortList(missing) || "none"}; extra: ${shortList(extra) || "none"}`,
  );
}

const sitemap = readFile(path.join(outputDirectory, "sitemap.xml"));
const canonicalUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1].replaceAll("&amp;", "&"),
);

test("sitemap routes are unique, canonical, and rendered", () => {
  assert.ok(canonicalUrls.length > 0, "sitemap must contain canonical page URLs");
  assert.equal(
    new Set(canonicalUrls).size,
    canonicalUrls.length,
    "sitemap contains duplicate canonical URLs",
  );

  for (const url of canonicalUrls) {
    readFile(htmlPathFor(url));
  }
});

test("canonical pages render meaningful, structurally valid HTML", () => {
  for (const url of canonicalUrls) {
    const html = readFile(htmlPathFor(url));
    const route = new URL(url).pathname;
    const mains = elements(html, "main");

    assert.equal(mains.length, 1, `${route} must contain exactly one main element`);
    assert.ok(
      containsLetterOrNumber(mains[0][1]),
      `${route} contains no visible text in its main element`,
    );

    for (const section of elements(html, "section")) {
      assert.ok(
        containsMeaningfulContent(section[1]),
        `${route} contains an empty section`,
      );
    }

    const ids = allOpeningTags(html)
      .map((tag) => attribute(tag, "id"))
      .filter(Boolean);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${route} contains duplicate element IDs`,
    );
  }
});

test("canonical pages expose the required social and favicon metadata", () => {
  for (const url of canonicalUrls) {
    const html = readFile(htmlPathFor(url));
    const route = new URL(url).pathname;
    const canonical = onlyTag(html, "link", "rel", "canonical", route);
    const favicon = onlyTag(html, "link", "rel", "icon", route);
    const twitterCard = onlyTag(html, "meta", "name", "twitter:card", route);

    assert.equal(attribute(canonical, "href"), url, `${route} canonical URL drifted`);
    assert.equal(
      attribute(twitterCard, "content"),
      "summary_large_image",
      `${route} Twitter card drifted`,
    );

    const openGraph = new Map();
    for (const property of [
      "og:site_name",
      "og:title",
      "og:description",
      "og:type",
      "og:url",
      "og:image",
      "og:image:width",
      "og:image:height",
    ]) {
      const meta = onlyTag(html, "meta", "property", property, route);
      const content = attribute(meta, "content");
      assert.ok(content, `${route} ${property} is empty`);
      openGraph.set(property, content);
    }

    assert.equal(openGraph.get("og:url"), url, `${route} og:url drifted`);

    for (const [twitterName, openGraphName] of [
      ["twitter:title", "og:title"],
      ["twitter:description", "og:description"],
      ["twitter:image", "og:image"],
    ]) {
      const twitter = onlyTag(html, "meta", "name", twitterName, route);
      assert.equal(
        attribute(twitter, "content"),
        openGraph.get(openGraphName),
        `${route} ${twitterName} drifted from ${openGraphName}`,
      );
    }

    for (const assetUrl of [attribute(favicon, "href"), openGraph.get("og:image")]) {
      const parsedAsset = new URL(assetUrl, SITE_ORIGIN);
      assert.equal(
        parsedAsset.origin,
        SITE_ORIGIN,
        `${route} metadata asset uses the wrong origin`,
      );
      const assetPath = path.join(
        outputDirectory,
        decodeURIComponent(parsedAsset.pathname).replace(/^\//, ""),
      );
      assert.ok(fs.existsSync(assetPath), `${route} metadata asset is not rendered`);
    }
  }
});

test("founder-led entry points expose three honest doors and the primary CV", () => {
  const home = readFile(path.join(outputDirectory, "index.html"));
  assert.match(home, /<title>Oceanheart · Rick Hallett<\/title>/);
  assert.match(home, /Stay human\. Work with what is coming\./);
  assert.match(home, /I’m Rick Hallett\./);
  assert.match(home, /Meet the machine; master yourself\./);
  assert.match(home, /Bring me the mess\. We’ll make a system\./);
  assert.match(home, /Come back into contact\. In-person, virtually or otherwise\./);
  assert.equal(
    openingTags(home, "article").filter((tag) => hasAttribute(tag, "data-door"))
      .length,
    3,
    "homepage must expose exactly three doors",
  );
  assert.match(home, /href="\/work-with-me\/"/);
  assert.match(home, /href="\/projects\/conversations-with-ai\/"/);
  assert.match(home, /Systems can adapt to human beings\. And I can make it happen\./);
  assert.doesNotMatch(home, /data-door="body"/);
  assert.doesNotMatch(home, /facebook/i);
  assert.doesNotMatch(home, /class="eyebrow"/);

  const llms = readFile(path.join(outputDirectory, "llms.txt"));
  assert.match(llms, /# Oceanheart · Rick Hallett/);
  assert.match(llms, /Choose by what the person is meeting/);
  assert.doesNotMatch(llms, /Richard Hallett builds dependable AI automations/);

  assert.ok(
    !fs.existsSync(path.join(outputDirectory, "doors", "index.html")),
    "retired doors draft must not render",
  );

  const conversationsWithAi = readFile(
    path.join(outputDirectory, "projects", "conversations-with-ai", "index.html"),
  );
  assert.match(conversationsWithAi, /early research and design/i);
  assert.match(conversationsWithAi, /It is not a course, treatment, or evidence-based intervention/);
  assert.match(conversationsWithAi, /precise data path, retention, and model provider/);

  const workWithMe = readFile(
    path.join(outputDirectory, "work-with-me", "index.html"),
  );
  assert.match(workWithMe, /There are three ways to begin with Oceanheart/);
  assert.match(workWithMe, /Human systems/);
  assert.match(workWithMe, /Good first problems/);
  assert.match(workWithMe, /What I take responsibility for/);

  const legacyHire = readFile(path.join(outputDirectory, "hire", "index.html"));
  const legacyCanonical = onlyTag(
    legacyHire,
    "link",
    "rel",
    "canonical",
    "/hire/",
  );
  assert.equal(
    attribute(legacyCanonical, "href"),
    `${SITE_ORIGIN}/work-with-me/`,
    "legacy hire route must point to the work-with-me page",
  );

  const cv = readFile(path.join(outputDirectory, "cv", "index.html"));
  assert.match(cv, /AI Automation &amp; Enablement Engineer/);
  assert.match(cv, /richard-hallett-ai-enablement-engineer\.pdf/);

  const primaryCv = fs.readFileSync(
    path.join(outputDirectory, "cv", "richard-hallett-ai-enablement-engineer.pdf"),
  );
  const compatibilityCv = fs.readFileSync(
    path.join(outputDirectory, "richard-hallett-cv.pdf"),
  );
  assert.deepEqual(
    compatibilityCv,
    primaryCv,
    "compatibility CV must be the AI Automation and Enablement variant",
  );
});

test("direct relational work begins with a data-minimal enquiry", () => {
  const relational = readFile(
    path.join(outputDirectory, "relational-work", "index.html"),
  );

  assert.match(relational, /Come back into contact\./);
  assert.match(relational, /In-person, virtually or otherwise\./);
  assert.match(relational, /data-intake-form/);
  assert.match(relational, /name="name"[^>]*required/);
  assert.match(relational, /name="for"[^>]*required/);
  assert.match(relational, /name="format"[^>]*required/);
  assert.match(relational, /name="minimum-information"[^>]*required/);
  assert.doesNotMatch(relational, /<input\b[^>]*type="email"/i);
  assert.doesNotMatch(relational, /<form\b[^>]*action="https?:/i);
  assert.doesNotMatch(relational, /posthog/i);
  assert.match(relational, /data-booking-state="unconfigured"/);
  assert.doesNotMatch(relational, /<iframe\b/i);
  assert.match(relational, /Nothing has been sent\./);

  for (const relativePath of [
    "index.html",
    path.join("about", "index.html"),
    path.join("work-with-me", "index.html"),
  ]) {
    const html = readFile(path.join(outputDirectory, relativePath));
    assert.match(
      html,
      /href="\/relational-work\/"/,
      `${relativePath} must link to direct relational work`,
    );
  }

  assert.ok(
    fs.existsSync(path.join(outputDirectory, "js", "relational-intake.js")),
    "relational intake script must be rendered",
  );
});

test("the tells index and sitemap expose exactly the same valid detail routes", () => {
  const indexPath = path.join(outputDirectory, "tells", "index.html");
  const sitemapRoutes = canonicalUrls
    .map((url) => new URL(url).pathname)
    .filter((route) => /^\/tells\/[^/]+\/$/.test(route))
    .sort();

  if (!fs.existsSync(indexPath)) {
    assert.deepEqual(sitemapRoutes, [], "sitemap exposes tells detail pages without an index");
    return;
  }

  const html = readFile(indexPath);
  const patternLinks = openingTags(html, "a").filter(
    (tag) => hasAttribute(tag, "data-pattern"),
  );
  const indexRoutes = patternLinks.map((tag) => attribute(tag, "href"));
  const patternIds = patternLinks.map((tag) => attribute(tag, "id"));

  assert.ok(patternLinks.length > 0, "tells index contains no pattern links");
  assert.equal(new Set(indexRoutes).size, indexRoutes.length, "tells index repeats a route");
  assert.equal(new Set(patternIds).size, patternIds.length, "tells index repeats an ID");

  for (let index = 0; index < patternLinks.length; index += 1) {
    assert.equal(
      indexRoutes[index],
      `/tells/${patternIds[index]}/`,
      `tells ID ${patternIds[index]} does not own its route`,
    );
  }

  assertSameRoutes(indexRoutes, sitemapRoutes, "tells index and sitemap detail routes drifted");

  const legacyDirectory = path.join(outputDirectory, "slopodar");
  const legacyIds = fs
    .readdirSync(legacyDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(
    legacyIds,
    [...patternIds].sort(),
    "legacy tell aliases and canonical tell IDs drifted",
  );

  const legacyIndexHtml = readFile(path.join(legacyDirectory, "index.html"));
  const legacyIndexCanonical = onlyTag(
    legacyIndexHtml,
    "link",
    "rel",
    "canonical",
    "/slopodar/",
  );
  assert.equal(
    attribute(legacyIndexCanonical, "href"),
    `${SITE_ORIGIN}/tells/`,
    "legacy tells index alias drifted",
  );

  for (const route of sitemapRoutes) {
    const patternId = route.split("/").filter(Boolean).at(-1);
    const detailHtml = readFile(
      path.join(outputDirectory, route.replace(/^\//, ""), "index.html"),
    );
    const detected = detailHtml.match(/<p\b[^>]*>\s*detected\s+([^<]+)<\/p>/i);
    assert.ok(detected, `${route} contains no detected field`);
    assert.ok(
      containsLetterOrNumber(detected[1]),
      `${route} contains an empty detected field`,
    );
    const fields = [
      ...detailHtml.matchAll(/<h[2-4]\b[^>]*>[\s\S]*?<\/h[2-4]>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi),
    ];
    assert.ok(fields.length > 0, `${route} contains no structured pattern fields`);
    for (const field of fields) {
      assert.ok(
        containsLetterOrNumber(field[1]),
        `${route} contains an empty pattern field`,
      );
    }
    const legacyHtml = readFile(
      path.join(legacyDirectory, patternId, "index.html"),
    );
    const legacyCanonical = onlyTag(
      legacyHtml,
      "link",
      "rel",
      "canonical",
      `/slopodar/${patternId}/`,
    );
    assert.equal(
      attribute(legacyCanonical, "href"),
      `${SITE_ORIGIN}${route}`,
      `/slopodar/${patternId}/ alias drifted`,
    );
  }
});
