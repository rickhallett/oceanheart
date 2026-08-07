"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const retired = require("../api/retired");
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"),
);

function matchRoute(pathname) {
  return config.routes.find((route) =>
    new RegExp(`^(?:${route.src})$`).test(pathname),
  );
}

function invoke(method = "GET") {
  const headers = new Map();
  let body = null;

  const response = {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(value) {
      body = value;
    },
  };

  retired({ method }, response);

  return { body, headers, statusCode: response.statusCode };
}

test("approved structural routes are permanent redirects", () => {
  const expected = new Map([
    ["/", "https://www.oceanheart.ai/"],
    ["/about/", "https://www.oceanheart.ai/about/"],
    ["/contact/", "https://www.oceanheart.ai/about/"],
    ["/author/richard/", "https://www.oceanheart.ai/blog/"],
    ["/tag/book/", "https://www.oceanheart.ai/blog/"],
    ["/tag/science/", "https://www.oceanheart.ai/blog/"],
    ["/tag/spirit/", "https://www.oceanheart.ai/blog/"],
    ["/tag/story/", "https://www.oceanheart.ai/blog/"],
  ]);

  for (const [pathname, destination] of expected) {
    const route = matchRoute(pathname);
    assert.equal(route.status, 301, pathname);
    assert.equal(route.headers.Location, destination, pathname);
  }
});

test("retired and unknown paths reach the catch-all function", () => {
  for (const pathname of [
    "/book/",
    "/best-codebase-architecture-for-ai-coding-and-ai/",
    "/not-a-real-old-path/",
  ]) {
    assert.equal(matchRoute(pathname).dest, "/api/retired", pathname);
  }
});

test("robots policy remains crawlable", () => {
  assert.equal(matchRoute("/robots.txt").dest, "/robots.txt");
  assert.equal(
    fs.readFileSync(path.join(__dirname, "..", "public", "robots.txt"), "utf8"),
    "User-agent: *\nAllow: /\n",
  );
});

test("retirement function returns 410 and the current-site link", () => {
  const response = invoke();

  assert.equal(response.statusCode, 410);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(response.body, /https:\/\/www\.oceanheart\.ai\//);
  assert.doesNotMatch(response.body, /noindex/i);
});

test("HEAD retirement response has no body", () => {
  const response = invoke("HEAD");

  assert.equal(response.statusCode, 410);
  assert.equal(response.body, undefined);
});
