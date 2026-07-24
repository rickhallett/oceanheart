+++
title = "Agent-native web: web scraping is programming, not browsing"
date = "2026-03-28"
description = "4 web/content categories. Web scraping is inherently programmatic. CMS is CRUD on structured content. SEO is data analysis + rule application."
tags = ["agent-native", "web", "scraping", "cms", "seo"]
draft = true

copy_metrics_version = 2
copy_word_count = 402
copy_sentence_count = 33
copy_paragraph_count = 10
copy_not_count = 0
copy_not_ratio = 0.00000000
copy_negation_count = 1
copy_contrast_frame_count = 1
copy_short_closure_count = 3
copy_single_sentence_paragraph_count = 0
copy_first_person_count = 1
copy_contraction_count = 2
copy_editorial_signpost_count = 0
copy_repeated_ngram_count = 0
+++

{{< draft-notice >}}

## 4 categories

Web scraping/automation, content management, SEO tools, and web browsers. The first three are straightforward. The interesting case is the browser itself, which splits in a way I didn't expect: targeted interaction is fully automatable, but open-ended research browsing still benefits from visual rendering.

## Web scraping is programming

Scraping a website is a programming task. The scraper parses the DOM, extracts data from selectors, follows links according to rules, handles pagination and writes structured output. `curl`, `wget`, `scrapy`, `playwright`, `puppeteer`, `cheerio` - these are programming tools. The browser rendering engine is an implementation detail used to execute JavaScript; visual rendering is unnecessary.

Playwright and Puppeteer run headless by default. The browser window is opt-in, for debugging. The agent scripts the interaction: navigate, wait for selector, extract text, click, repeat. Targeted web automation - filling forms, clicking buttons, extracting specific data - is fully programmable.

## The browsing edge case

Open-ended research browsing - "find information about X, follow interesting leads" - benefits from visual rendering because web pages are designed for visual consumption. Layout, emphasis, sidebars, navigation menus - these carry information that's lost in raw HTML.

Headless browsers with screenshots close most of this gap. The agent can render a page, capture the screenshot and use vision capabilities to interpret the layout, although dense pages can still carry semantic meaning in their visual structure.

## CMS is CRUD

WordPress, Ghost, Contentful, Strapi, Sanity - content management systems are databases with content-specific schemas. Posts, pages, media, taxonomies, users, permissions. All expose APIs (REST or GraphQL). Ghost's Content API and Admin API are clean. WordPress has a REST API. Headless CMS platforms like Contentful and Strapi are API-first by design.

The WYSIWYG editor exists because people want to see formatted text while writing it, which is reasonable. The agent writes Markdown or structured content and submits via API.

Hugo, Astro, Next.js with MDX - static site generators already work this way. The content is files in a repository. The build is a CLI command. The CMS GUI is optional.

## SEO

Google Search Console has an API. Ahrefs, SEMrush, Moz - these have APIs for rank tracking, backlink analysis, keyword research. SEO is data collection (crawl the site, check meta tags, analyse performance) plus rule application (title length, heading structure, alt text, page speed). Both are programmable.

The audit dashboard is a rendering of structured findings. The agent runs the audit and gets JSON.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 33-36 (Web/Content section)
