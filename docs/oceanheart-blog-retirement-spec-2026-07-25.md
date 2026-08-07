# oceanheart.blog retirement spec

Status: Approved with amendments, implementation authorised

Date: 2026-07-25

Scope: Retire the legacy `oceanheart.blog` publication and its search surface without changing the current `www.oceanheart.ai` site

Production changes authorised by this document: Dedicated `oceanheart.blog` retirement release only

## 1. Decision

Retire `oceanheart.blog` as a public content origin.

The target end state is:

- `oceanheart.blog` and `www.oceanheart.blog` have valid TLS.
- A small set of genuinely equivalent legacy routes return a one-hop `301` to a canonical `https://www.oceanheart.ai/...` route.
- Legacy articles with no equivalent current page return `410 Gone` with a short human-readable retirement page.
- Unknown legacy paths also return `410 Gone`.
- The domain remains registered and renewed.
- Existing email forwarding DNS records remain intact.
- Search crawlers are allowed to reach every old URL so they can observe the `301` or `410`.
- The legacy Ghost publication is no longer part of the serving path.

This is not a blanket redirect of every old URL to the new homepage. Google explicitly warns that redirecting many unrelated old URLs to one irrelevant destination can be treated as a soft `404`.

## 2. What is being killed

The target is the old publication and the public claims attached to it, not the current Oceanheart identity or current blog.

The historical inventory contains 61 HTML routes:

- 52 legacy article routes.
- 9 homepage, identity, contact, book, author, and tag routes.

The article set mixes:

- therapy, self-help, and behavioural advice;
- spirituality and religious interpretation;
- AI maximalism and broad AI claims;
- AI and wellbeing claims;
- fertility, attention, productivity, and human-behaviour commentary;
- old Oceanheart brand positioning.

These routes predate the current positioning at `www.oceanheart.ai`, which is an evidence-led software and agentic-systems portfolio.

## 3. Research findings

Observed on 2026-07-25:

| Surface | Observation | Meaning |
| --- | --- | --- |
| Google web search | `site:oceanheart.blog` returned no matching documents | No legacy page was discoverable through this query at observation time. A `site:` query is useful evidence, but is not a complete index report. |
| Ordinary keyword search | On 2026-07-24, the operator observed the old about, contact, tag, and book routes ranking in ordinary searches, in some cases above current `.ai` content | The empty `site:` query does not justify assuming that the exposure window is closed. Page Indexing must decide whether temporary removal is needed. |
| General web search | Old titles still appear in LinkedIn shares | Third-party links and title residue remain even when the old origin is absent from Google results. |
| Google Search Console | The current signed-in account had no access to the Domain properties for either `oceanheart.blog` or `oceanheart.ai` | Search Console verification or access recovery is required before Page Indexing, Links, Change of Address, or Removals can be used. |
| Apex DNS | `oceanheart.blog` resolves to `178.128.137.126` | This is Ghost's documented apex redirect address, not evidence of a user-controlled server. |
| `www` DNS | `www.oceanheart.blog` is a CNAME to `oceanheart-ai.ghost.io` | The legacy domain is still wired to Ghost. |
| Apex HTTPS | TLS handshake failed | The apex is not a valid retirement endpoint. |
| `www` HTTPS | Ghost returned `404` with a "Domain error" page and a fallback TLS certificate | The public hostname is broken rather than intentionally retired. |
| Ghost subdomain | `oceanheart-ai.ghost.io` returned `402` with "Site unavailable" | The Ghost publication is unavailable. |
| HTTP variants | HTTP redirects toward the broken HTTPS variants | Users and crawlers are led into failure. |
| Email DNS | Namecheap forwarding MX records and an SPF TXT record are present | DNS migration must preserve mail forwarding records. |
| Historical inventory | Internet Archive CDX returned 61 distinct successful HTML routes | This is the seed retirement inventory. It is not guaranteed to contain every URL ever published. |
| Current site | No legacy article path has an exact current article equivalent | Article redirects require explicit editorial approval. Defaulting them to the homepage would be misleading. |

The current state is already dead at the content layer, but it is technically poor: broken TLS, Ghost error responses, no declared permanent move, and no useful handling for old links.

## 4. Goals

1. Make every old domain variant deterministic for users and crawlers.
2. Prevent legacy content from returning to search results.
3. Transfer only defensible identity and archive signals to the current site.
4. Avoid soft `404` behaviour caused by irrelevant mass redirects.
5. Preserve domain control and mail forwarding.
6. Keep implementation isolated from the current Hugo site's routing.
7. Produce verifiable evidence for DNS, TLS, HTTP status, Search Console, and Bing Webmaster Tools.

## 5. Non-goals

- Republish the old Ghost archive.
- Import old articles into the current Hugo blog.
- Rewrite or rehabilitate legacy claims.
- Redirect every old article to the current homepage or blog index.
- Delete the domain registration.
- Change the current `www.oceanheart.ai` information architecture.
- Cancel Ghost before a private export decision has been made.
- Use `robots.txt` to hide legacy URLs.

## 6. Route policy

### 6.1 Approved structural redirects

These routes have a defensible current equivalent:

| Legacy path | Destination | Status | Reason |
| --- | --- | --- | --- |
| `/` | `https://www.oceanheart.ai/` | `301` | Current canonical identity homepage |
| `/about/` | `https://www.oceanheart.ai/about/` | `301` | Current canonical about page |
| `/contact/` | `https://www.oceanheart.ai/about/` | `301` | Current about page contains the canonical contact details |
| `/author/richard/` | `https://www.oceanheart.ai/blog/` | `301` | Current writing archive for the same author |
| `/tag/book/` | `https://www.oceanheart.ai/blog/` | `301` | Legacy archive index, not an article |
| `/tag/science/` | `https://www.oceanheart.ai/blog/` | `301` | Legacy archive index, not an article |
| `/tag/spirit/` | `https://www.oceanheart.ai/blog/` | `301` | Legacy archive index, not an article |
| `/tag/story/` | `https://www.oceanheart.ai/blog/` | `301` | Legacy archive index, not an article |

`/book/` has no current equivalent and returns `410`.

### 6.2 Legacy article default

Every legacy article returns `410 Gone` unless the operator approves an exact or substantively equivalent current destination.

An approved exception must record:

- old path;
- new canonical URL;
- why the destination is genuinely equivalent;
- reviewer;
- approval date.

Topical similarity is not enough. A broad AI article must not redirect to an unrelated current AI article just to capture authority.

### 6.3 Unknown paths and assets

- Unknown paths return `410`.
- Old images, feeds, sitemaps, and Ghost-specific paths return `410` unless explicitly retained for a technical reason.
- `robots.txt` returns `200` and allows crawling:

```text
User-agent: *
Allow: /
```

- The retirement host does not publish an old-content sitemap.
- Query strings do not change the route decision.

### 6.4 Human-readable `410` response

The `410` body should be plain and short:

> This page belonged to an earlier Oceanheart publication and has been retired. The current site is oceanheart.ai.

It must include one link to `https://www.oceanheart.ai/`. It must not reproduce, summarise, or defend the old article.

## 7. Recommended serving architecture

Use a dedicated Vercel retirement project attached only to:

- `oceanheart.blog`
- `www.oceanheart.blog`

Keep it separate from the existing Oceanheart Hugo project. This prevents host-specific retirement rules from affecting `www.oceanheart.ai`.

The project should contain:

- a small explicit redirect map;
- a catch-all Vercel Function that returns `410` with the retirement body;
- the allow-all `robots.txt`;
- a minimal human-readable retirement response;
- automated status and `Location` tests.

Use explicit `301` responses rather than relying on a platform default. Google supports both `301` and `308`, but explicit `301` matches the migration and Change of Address documentation.

Static `vercel.json` routing cannot produce the required `410` response with a body. It may route the request, but the final fallback response must come from the catch-all function.

Do not hard-code Vercel DNS targets in this spec. Use the exact records returned by Vercel when the two domains are attached.

## 8. DNS requirements

The domain currently uses Namecheap BasicDNS. Keep the nameservers in place and change only the web-serving records.

Required sequence:

1. Add both old hostnames to the dedicated retirement project.
2. Obtain the exact Vercel verification and routing records.
3. Add any required domain-verification TXT record.
4. Replace the apex Ghost A record.
5. Replace the `www` Ghost CNAME.
6. Preserve all existing MX records.
7. Preserve the SPF TXT record.
8. Preserve unrelated TXT, CAA, DKIM, DMARC, and verification records.
9. Wait for Vercel to provision valid certificates for both hostnames.
10. Verify HTTP and HTTPS, apex and `www`, before considering the cutover complete.

Do not change nameservers merely to implement the redirect.

## 9. Ghost archive and shutdown

Before cancelling or deleting anything in Ghost:

1. Decide whether the old content needs a private archive.
2. If the publication can be made available without republishing it, export Ghost content and download media.
3. Store any export privately outside Git.
4. Record the export date, coverage, and storage location without putting raw content into this repository.
5. Only then remove the custom domain from Ghost and cancel the unused Ghost service.

If the Ghost publication cannot be recovered economically, the Internet Archive route inventory is sufficient for the retirement map, but not a complete private content backup.

Ghost is not required to serve the final retirement state.

The archive decision is capped at 24 hours and must not block the cutover. For this release, the decision is to proceed without recovering the unavailable Ghost publication. A later private recovery, if desired, is separate work.

## 10. Google plan

### 10.1 Removal decision

Do not let the empty `site:` query decide whether temporary removal is needed.

Once Search Console owner access is recovered:

1. Open Page Indexing for the old property.
2. If any `oceanheart.blog` URL appears in the indexed set, file the site-wide temporary Removal request alongside the permanent `301` and `410` deployment.
3. If Page Indexing confirms that no old URL is indexed, record that result and skip the request.

The temporary request is only an exposure-window control. The permanent serving state remains authoritative.

### 10.2 Search Console prerequisites

Obtain owner access to:

- `oceanheart.blog`;
- `oceanheart.ai`;
- applicable `www` and non-`www` URL-prefix variants requested by the Change of Address flow.

Prefer DNS verification so ownership survives the serving migration.

Do not replace the existing SPF TXT record when adding Google verification. Add a separate TXT record.

### 10.3 After the redirects are live

1. Inspect the old homepage, `/about/`, one tag route, and at least three `410` article routes with URL Inspection.
2. Confirm Googlebot sees the same status and destination as a normal user agent.
3. Submit Change of Address from the applicable old properties to `oceanheart.ai`.
4. Submit every applicable old host variant if the tool requires separate moves.
5. Record that most legacy routes intentionally return `410`. The Change of Address tool may warn about them; they must not later be converted to irrelevant redirects as a supposed repair.
6. Keep the redirect service active for at least 180 days.
7. Keep the domain registered for at least one year, preferably indefinitely.

Search Console is the authoritative place to determine whether hidden indexed URLs remain. The `site:` operator alone is not an exhaustive inventory.

## 11. Bing and Copilot plan

After the permanent serving state is live:

1. Verify `oceanheart.blog` in Bing Webmaster Tools.
2. Use Site Explorer and URL Inspection to identify any indexed legacy URLs.
3. Do not use Block URLs unless an indexed result needs immediate suppression.
4. If used, remember that Bing's block is temporary for 90 days.
5. Let the permanent `301` and `410` responses do the lasting work.

## 12. Rollout

### Phase A: preservation and map review

- Record the bounded archive decision: do not recover the unavailable Ghost publication before cutover.
- Review the structural redirect table.
- Review the 52-route `410` inventory.
- Add any explicitly approved article-to-article mappings.
- Confirm Vercel project ownership and Namecheap DNS access.
- Recover or establish Search Console owner access.

Time cap: 24 hours. Exit gate: route map approved and archive decision recorded. Archive recovery cannot block the cutover.

### Phase B: build and pre-production verification

- Create the isolated retirement project.
- Implement the redirect map, `410` fallback, and `robots.txt`.
- Test every inventory route against a preview or local test surface.
- Confirm the current Oceanheart Hugo project is unchanged.

Exit gate: automated route matrix passes with no homepage catch-all.

### Phase C: domain cutover

- Attach apex and `www`.
- Apply the exact DNS records supplied by Vercel.
- Preserve mail records.
- Wait for valid TLS.
- Verify all four protocol and hostname entry points.

Exit gate: no TLS errors, no Ghost error pages, and all paths reach their final result in one hop after HTTP-to-HTTPS normalisation.

### Phase D: search declaration

- Complete Google Search Console verification.
- Run URL Inspection checks.
- Submit Change of Address.
- Inspect Bing Webmaster Tools.
- Use temporary removal only for an actually visible result.

Exit gate: search tools can crawl the retirement responses and the move is recorded.

Phases B through D are one release session. If the redirect surface is not live by the end of that session, stop and record the concrete blocker rather than expanding the programme.

There is no monitoring phase. Close-out consists of:

- one domain-renewal reminder;
- one Search Console check at day 30.

## 13. Acceptance criteria

### HTTP and TLS

- `https://oceanheart.blog/` has a valid certificate and returns `301`.
- `https://www.oceanheart.blog/` has a valid certificate and returns `301`.
- HTTP variants normalise without a loop.
- No request returns the Ghost "Domain error" or "Site unavailable" page.

### Route semantics

- All approved mappings return exactly `301`.
- Every redirect has one final canonical destination.
- No legacy article redirects to the homepage unless explicitly approved as equivalent.
- All default-retired article routes return exactly `410`.
- Unknown paths return exactly `410`.
- The `410` body contains no legacy article text.
- `robots.txt` returns `200` and does not block crawling.

### Current-site safety

- `www.oceanheart.ai` continues to build and deploy from its existing project.
- Current routes and sitemap are unchanged by the retirement project.
- No old hostname appears as a canonical URL on the current site.

### DNS and mail

- Ghost web records are gone.
- Existing MX records are unchanged.
- Existing SPF is unchanged.
- Both old hostnames resolve to the retirement service.

### Search

- Search Console owner access exists for old and new properties.
- Change of Address is accepted or its exact blocker is recorded.
- URL Inspection observes the expected `301` and `410` responses.
- Bing Site Explorer has no unexplained indexed old routes.

## 14. Verification matrix

Test at minimum:

| Request | Expected |
| --- | --- |
| `http://oceanheart.blog/` | Normalises, then one canonical `301` destination |
| `https://oceanheart.blog/` | `301` to `https://www.oceanheart.ai/` |
| `http://www.oceanheart.blog/` | Normalises, then one canonical `301` destination |
| `https://www.oceanheart.blog/` | `301` to `https://www.oceanheart.ai/` |
| `/about/` | `301` to current `/about/` |
| `/contact/` | `301` to current `/about/` |
| `/author/richard/` | `301` to current `/blog/` |
| each `/tag/.../` route | `301` to current `/blog/` |
| `/book/` | `410` |
| three representative legacy articles | `410` |
| every inventory path in the automated matrix | expected route-specific status |
| `/not-a-real-old-path/` | `410` |
| `/robots.txt` | `200`, crawl allowed |

Verification must inspect:

- status code;
- `Location` header where applicable;
- redirect hop count;
- TLS certificate hostname;
- response body for `410`;
- normal and Googlebot user agents;
- desktop browser behaviour for one `301` and one `410`.

## 15. Rollback

Rollback is DNS-level and project-level:

1. Reassign the old hostnames to the last known retirement deployment.
2. Restore the previous web DNS records only if the intent is to restore Ghost.
3. Do not restore the broken current DNS state as a normal rollback target.
4. Keep a copy of the approved route map and last verified deployment ID.

Search Console Change of Address can be cancelled within its active window, but cancellation also requires changing the server directives. Do not cancel one layer without the other.

## 16. Risks

| Risk | Control |
| --- | --- |
| Blanket homepage redirect becomes a soft `404` | Explicit mapping plus `410` fallback |
| Search Console cannot be used | Recover owner access before search declaration |
| DNS cutover breaks email forwarding | Preserve MX and SPF, change only web records |
| Ghost is cancelled before export | Make a private archive decision first |
| `robots.txt` prevents crawlers seeing removal | Allow crawling |
| Current Hugo site is affected | Dedicated retirement project |
| Unknown old URLs survive | `410` fallback plus Search Console and Bing inventory checks |
| Domain is later acquired by someone else | Renew indefinitely |
| A topical but non-equivalent redirect misleads users | Human approval required for article exceptions |

## 17. Seed `410` inventory

These 52 known article paths default to `410`:

```text
/5-practical-ways-to-work-with-resistance/
/age-of-agents-how-to-evolve-your-o3-mini-prompts-2/
/ai-and-the-compulsion-economy-how-technology-monetizes-human-behavior/
/ai-velocity-an-example-of-my-ai-enhanced-workflow-apr-2025/
/alright-lets-talk-ai-tools-choosing-augmentation-over-overload/
/behavioural-economics-series-ambiguity-effect-illuminating-the-unknown-in-ai-driven-care/
/behavioural-economics-series-scarcity-leveraging-limited-resources-tinder/
/best-codebase-architecture-for-ai-coding-and-ai/
/beyond-generic-ai-advice-why-i-built-synai-and-why-it-changes-everything/
/blog-post-cant-focus-maybe-its-not-just-you/
/blog-summary-fertility-science-ai-finding-the-signal-amidst-the-noise/
/cultivating-ai-cognitive-immunity-our-first-and-last-defence/
/gemma-powered-ai-for-wellbeing-professionals/
/habit-theory-building-adaptive-loops-in-an-ai-driven-world-2/
/how-to-allow-anger-without-hurting-yourself-or-others/
/journey-to-the-lord-of-power-a-sufi-manual-on-retreat/
/oceanheart-ai-an-introduction/
/our-greatest-desire-to-be-seen/
/part-1-of-3-the-clinicians-ai-dilemma-big-tech-vs-big-heart/
/part-2-of-3-the-human-upgrade-guiding-ai-with-skills-we-already-have/
/part-3-of-3-beyond-theory-putting-experiential-ai-mastery-into-practice/
/principles-volume-one-the-no-bullshit-codex-for-effective-human-interaction-2/
/science-ai-and-the-amplification-of-cognitive-biases/
/science-ai-and-the-human-attention-crisis/
/science-impatience-and-impulsivity-in-the-age-of-ai/
/science-part1-human-evolutionary-stability-in-the-age-of-ai/
/science-redefining-engineering/
/science-the-commodification-of-human-behavior-in-the-ai-age/
/science-the-dark-side-of-ai-amplifying-human-flaws/
/science-the-hyperconnected-world/
/science-the-productivity-paradox-ais-impact-on-efficiency-and-distraction/
/science-transforming-gen-ai/
/seeing-is-believing-2/
/spirit-the-art-of-deep-meditation-a-journey-beyond-the-ordinary/
/spirit-the-psychological-significance-of-genesis/
/spirit-two-lenses/
/spirit-understanding-higher-consciousness/
/story-biblical-narratives-act/
/the-comfort-trap-and-how-to-escape-it/
/the-drunken-buddha-aka-ben-the-heart/
/the-erosion-of-patience-in-the-ai-age/
/the-evolving-dialogue-psychotherapy-and-religion-in-the-21st-century/
/the-machine-maximalist-manifesto-why-ai-ml-should-be-everywhere/
/the-oceanheart-way-give-more/
/the-scarcity-of-self-a-crisis-of-misplaced-meaning/
/the-trifecta-of-the-oceanhearted-a-means-to-getting-real-and-helping-the-world-2/
/there-is-still-time-the-primary-trends-in-fertility-science-ai/
/this-isnt-your-average-therapy-session/
/why-am-i-doing-this-a-brief-tour-through-history-the-present-and-future/
/why-nervous-system-regulation-is-not-enough-to-deeply-heal/
/why-oceanheart-ai-2/
/why-your-self-help-isnt-helping-the-counterintuitive-path-to-personal-growth/
```

## 18. Sources

Primary guidance:

- [Google: Site moves and migrations](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- [Google: Change of Address tool](https://support.google.com/webmasters/answer/9370220)
- [Google: Removals and SafeSearch reports tool](https://support.google.com/webmasters/answer/9689846)
- [Google: Block indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Google: Introduction to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Bing: Temporarily Block URLs](https://www.bing.com/webmasters/help/Block-URLs-264e560b)
- [Bing: Permanently remove a URL or page](https://www.bing.com/webmasters/help/how-to-permanently-remove-a-url-or-page-from-bing-or-copilot-37c07477)
- [Ghost: Adding a custom domain](https://ghost.org/help/using-custom-domains/)
- [Vercel: Deploying and redirecting domains](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting)
- [Vercel: Static configuration and redirects](https://vercel.com/docs/project-configuration/vercel-json)

Observed inventory:

- [Internet Archive CDX query for successful legacy HTML routes](https://web.archive.org/cdx/search/cdx?url=oceanheart.blog/*&output=json&fl=original,timestamp,statuscode,mimetype&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey)
