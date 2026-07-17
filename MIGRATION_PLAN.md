# Migration Plan

This plan rebuilds the compromised WordPress site as a new secure Next.js App Router site. The WordPress installation remains an untrusted data source throughout the process.

## Current Gate

SQL inspection can proceed from the approved SQL dump now identified at `sls-bkup/sls_database/upgradn1_WPI90.sql/upgradn1_WPI90.sql`.

Implementation beyond SQL-only inspection should not begin until these remaining approved inputs are available or confirmed:

- Separately copied uploads directory outside quarantined WordPress folders.
- Old public domain name confirmation. SQL currently reports `https://simplelifesaver.com`.
- Remote image retrieval decision. Default remains offline-only.

The permalink structure was recovered from SQL as `/%postname%/`.

## Phase 1: Read-only Inventory

Goals:

- Identify SQL dump path and compression format. Completed: plain SQL dump found.
- Safely detect WordPress table prefix. Completed: `r14_`.
- Inventory relevant tables and counts for published posts, pages, attachments, categories, tags, users/authors, and non-public content. Completed from SQL.
- Discover `siteurl`, `home`, WordPress database version where available, and permalink settings. Completed from SQL.
- Detect SEO plugin metadata presence, including Yoast, Rank Math, and All in One SEO fields. Completed from SQL.
- Report suspicious database content, URLs/domains, administrator accounts, and media-extension inventory. Completed from SQL attachment records; filesystem media inventory still blocked.

Deliverables:

- `RECOVERY_INVENTORY.md`
- `SECURITY_BOUNDARY.md`
- `MIGRATION_PLAN.md`

Stop condition:

- If the SQL dump is absent, unreadable, encrypted, malformed, or cannot be parsed safely, stop and report the blocker.
- If a separately copied uploads directory is absent, do not use quarantined `wp-content__acfa4f0/uploads`; stop media recovery and report the blocker.

## Phase 2: Read-only Extraction Utility

Status: implemented pending user confirmation.

`tools/wordpress-recovery/` is an isolated TypeScript utility with its own package metadata, tests, and README.

Core behavior:

- Supports `.sql`, `.sql.gz`, and `.zip` containing SQL.
- Parses SQL dumps directly; does not start WordPress, execute PHP, start MySQL, import the database, copy media, or sanitize article HTML.
- Reads only the logical WordPress tables needed for content extraction:
  - `{prefix}_posts`
  - `{prefix}_postmeta`
  - `{prefix}_terms`
  - `{prefix}_term_taxonomy`
  - `{prefix}_term_relationships`
  - `{prefix}_users`
  - `{prefix}_usermeta`
  - `{prefix}_options`
- Extracts only published `post` and `page` rows as content, and `attachment` records as media references requiring later validation.
- Reports drafts, private posts, revisions, nav menu items, custom post types, and orphaned attachments instead of publishing them automatically.

Validation:

- `npm test` passed 6/6 tests.
- Real-dump smoke run succeeded against the approved SQL dump and wrote output to a temp directory only.
- Smoke counts: 7,043 published posts, 25 published pages, 891 attachments, 473 non-public report entries, 423 custom post type report entries, and 275 orphaned attachment report entries.

## Phase 3: Sanitization and Malware Reports

Status: implemented pending user confirmation.

The recovery utility now includes a dependency-free server-side allowlist sanitizer. A `jsdom` install attempt failed because npm could not resolve a transitive `lru-cache` version from the registry, so the implementation uses an explicit tokenizer/allowlist pipeline instead of adding that dependency.

The sanitizer:

- Preserves only approved editorial tags and narrow safe attributes.
- Removes dangerous tag blocks such as scripts, styles, iframes, objects, embeds, forms, and SVG.
- Removes inline event handlers, inline styles, malformed URLs, disallowed protocols, tracking pixels, PHP fragments, suspicious comments, and unknown shortcodes.
- Allows only `http:`, `https:`, `mailto:`, `tel:`, relative paths, and anchors, while reporting HTTP and external links for review.
- Writes sanitized JSON without raw recovered HTML or executable MDX/JSX.

Required reports:

- `reports/removed-content.json`
- `reports/suspicious-links.json`
- `reports/suspicious-html.json`

Each report entry must include post ID, post title, original path, reason, escaped preview, severity, and whether manual review is needed.

Recovered content should become safe structured content or safe Markdown/HTML. Do not generate executable MDX from recovered text.

Validation:

- `npm test` passed 16/16 tests.
- Real-dump sanitizer run produced 7,068 sanitized published posts/pages.
- Reports generated: 29,646 removed-content entries, 1,825 suspicious-link entries, and 0 suspicious-HTML entries.
- Targeted check found no `rawContent`, no `requiresSanitization`, and no literal matches for `<script`, `<iframe`, `javascript:`, event handlers, PHP fragments, or `data:text/html` in `sanitized-content-output/sanitized-content.json`.

## Phase 4: WordPress Formatting Conversion

Status: implemented pending user confirmation.

The recovery utility now includes a WordPress formatting conversion pipeline that runs before sanitization.

Converted visible editorial structure while removing execution surfaces:

- Gutenberg block comments become safe structural content.
- Classic Editor HTML is sanitized and normalized.
- Captions, galleries, image blocks, columns, tables, quotes, lists, buttons, and headings are preserved where safe.
- Buttons become safe links.
- YouTube embeds become canonical links or manually approved safe embed components.
- Unknown shortcodes are not executed and are recorded in `reports/unknown-shortcodes.json`.

Validation:

- `npm test` passed 22/22 tests.
- Real-dump formatter run produced 7,068 formatted and sanitized posts/pages.
- Reports generated: 80 unknown-shortcode entries, 0 formatting-warning entries, 29,608 removed-content entries, 1,825 suspicious-link entries, and 0 suspicious-HTML entries.
- Targeted check found no Gutenberg wrappers, caption/gallery/embed shortcodes, iframes, scripts, unsafe protocols, event handlers, PHP fragments, or `data:text/html` in `formatted-content-output/sanitized-content.json`.

## Phase 5: Media Recovery

Status: scanner implemented pending user confirmation.

Use only the separately supplied `approved-uploads` directory. Do not scan or trust quarantined `wp-content__acfa4f0/uploads`.

Media pipeline:

- Validates paths and rejects symlinks or traversal.
- Validates file signatures.
- Rejects executable, ambiguous, oversized, double-extension, mismatched, or unsupported files.
- Decodes and re-encodes accepted raster images with Sharp.
- Preserves meaningful safe filenames, source-relative year/month paths, dimensions, and content hashes.
- Writes controlled output under `recovered-media-output/media/` for review before the production app is created.
- Uses content hashes to detect duplicates.

Required reports:

- `reports/media-accepted.json`
- `reports/media-rejected.json`
- `reports/media-missing.json`
- `reports/media-duplicates.json`

Validation:

- `npm test` passed 11/11 tests after adding media scanner coverage.
- Real approved-upload scan accepted 7,268 files, rejected 14 files, found 1,903 duplicates, and reported 0 missing files.
- Accepted source types: 6,578 JPEG, 559 PNG, 118 WebP, 10 GIF, and 3 PDFs.
- Rejected files include `.php`, `.htaccess`, `.CSV`, `.xlsx`, `.mp4`, and an oversized `copy.zip`.

## Phase 6: URL Preservation and Redirects

Status: implemented pending user confirmation.

Generated `data/route-manifest.json` with:

- Post ID
- Original absolute URL
- Original pathname
- New pathname
- Content type
- HTTP status expectation
- Canonical path
- Redirect required
- Redirect destination

Rules:

- Preserve original public paths exactly when possible.
- Preserve or intentionally normalize trailing-slash behavior.
- Never reuse a path for unrelated content.
- Add permanent redirects only when exact preservation is impossible.
- Prevent redirect loops and chains.
- Preserve query-independent canonical URLs.
- Flag duplicate slugs and route collisions for manual review.
- Do not redirect all missing pages to the homepage.

Validation:

- `npm test` passed 29/29 tests.
- Real route generation produced 7,068 manifest entries from `formatted-content-output/sanitized-content.json`.
- Exact path preservation was possible for all entries; `data/redirects.json` is empty.
- `reports/route-collisions.json` is empty.
- Two entries require manual review because their slugs required URL encoding normalization for unusual replacement-character suffixes.
- The Windows/npm `%postname%` caret-escaping issue is covered by a regression test.

## Phase 7: SEO Metadata

Status: implemented pending user confirmation.

Recovered and sanitized legitimate metadata:

- WordPress title and excerpt.
- Yoast, Rank Math, and All in One SEO titles/descriptions where available.
- Canonical URLs only when on an approved domain.
- Open Graph image when backed by accepted media.
- Publication date, modified date, author, categories, and tags.

Generate:

- Next.js Metadata API output.
- Canonical tags.
- Open Graph and Twitter card metadata.
- Article structured data.
- Breadcrumb structured data where appropriate.
- XML sitemap.
- `robots.txt`.
- RSS feed.

Do not preserve spam titles, malicious redirects, suspicious schema, hidden keywords, casino/pharmaceutical spam, unknown canonical domains, or encoded scripts.

Validation:

- `npm test` passed 35/35 tests.
- Real SEO generation produced 7,068 metadata records in `data/seo-metadata.json`.
- `sitemap.xml` contains 559 indexable URLs; 6,509 entries are marked noindex due to recovered noindex metadata or suspicious spam signals.
- `reports/seo-review.json` contains 19,058 review entries, including rejected gambling/casino metadata and noindex exclusions.
- `robots.txt`, `rss.xml`, `sitemap.xml`, `data/seo-metadata.json`, and `reports/seo-review.json` were generated.
- Targeted checks found no literal executable patterns in SEO metadata and no casino/pokies/slots/blackjack/real-money/bonus-code matches in sitemap or RSS.

## Phase 8: Internal Links

Status: implemented pending user confirmation.

Build an old-to-new URL map and rewrite only internal links:

- Old domain absolute URLs across HTTP, HTTPS, `www`, and non-`www`.
- URL-encoded paths.
- Trailing slash variants.
- Relative links.
- Anchor links.
- Media URLs.

Report unresolved internal links in `reports/broken-internal-links.json`.

Legitimate external links remain external. Suspicious external domains are flagged for manual review.

Validation:

- `npm test` passed 44/44 tests.
- Real link rewriting processed 7,068 formatted/sanitized posts/pages.
- `data/linked-content.json`, `data/link-summary.json`, `reports/broken-internal-links.json`, `reports/suspicious-external-links.json`, and duplicate review artifacts under `link-output/` were generated.
- 28,242 internal/media links were rewritten to canonical article paths or `/media/` paths.
- 1,697 external links were preserved as external.
- 130 unresolved internal links remain in `reports/broken-internal-links.json` for manual review, including category/search/archive-style targets, unpublished/missing slugs, and old WordPress admin URLs.
- Old `wp-admin` links were neutralized in rewritten content and reported as high severity.
- 111 suspicious external links remain in `reports/suspicious-external-links.json`, including neutralized external WordPress admin links from theme-demo content and casino-domain links from spammy recovered content.

## Phase 9: New Site Design

Status: implemented pending user confirmation.

Create a polished editorial site rather than copying the compromised WordPress theme.

Deliverables:

- `DESIGN_DIRECTION.md`
- `CONTENT_ARCHITECTURE.md`

Implementation goals:

- Mobile-first layout.
- Premium, trustworthy visual style inferred from recovered content.
- Clear typography and comfortable article width.
- Accessible navigation, search, archives, breadcrumbs, related articles, table of contents for long articles, reading-time estimate, tracker-free sharing, newsletter CTA without an active provider, footer, and custom 404.
- Neutral placeholders for missing brand assets, clearly marked for replacement.

Avoid generic WordPress styling, excessive animation, layout shifts, fake content, fake testimonials, low contrast, tiny text, and overloaded sidebars.

Validation:

- Created `DESIGN_DIRECTION.md` with a modern editorial direction inferred from indexable recovered content.
- Created `CONTENT_ARCHITECTURE.md` with file-based collections, route templates, archive behavior, search strategy, related-content rules, manual-review gates, and Next.js App Router implementation notes.
- The design direction explicitly avoids old WordPress theme/demo styling, fake content, unreviewed placeholders, and recovered executable/theme artifacts.
- Content architecture is grounded in controlled recovery outputs: `data/linked-content.json`, `data/route-manifest.json`, `data/seo-metadata.json`, media reports, and manual review reports.

## Phase 10: Accessibility and Performance

Status: implemented as a rebuild standard pending user confirmation. Full rendered-page validation is blocked until the Next.js app exists.

Meet practical WCAG 2.2 AA expectations:

- Semantic landmarks.
- Logical heading order.
- Keyboard navigation.
- Visible focus indicators.
- Skip-to-content link.
- Descriptive alt text and appropriate empty decorative alt text.
- Accessible menus and forms.
- Reduced-motion support.
- Strong contrast.
- Responsive text sizing.

Optimize for:

- Static generation.
- Minimal client JavaScript.
- Next.js Image.
- Responsive image sizes.
- Font optimization.
- Core Web Vitals.
- Lazy loading below-the-fold content.

Validation:

- Created `ACCESSIBILITY_PERFORMANCE.md` with WCAG-oriented acceptance criteria, page-level requirements, media accessibility rules, performance budgets, rendering strategy, CSS/focus standards, and testing gates.
- The standard requires semantic landmarks, logical headings, keyboard operation, visible focus, skip link, accessible menus/forms, reduced motion, contrast, responsive text, minimal client JavaScript, static generation, optimized fonts, responsive images, and no recovered WordPress scripts/styles.
- Full Playwright, accessibility, and Lighthouse validation must happen after the Next.js app is scaffolded and rendered pages exist.

## Phase 11: Content Model and Tests

Status: implemented pending user confirmation.

Create Zod-validated content schemas for articles, authors, categories, tags, media, routes, reports, SEO metadata, and safe content.

Testing strategy:

- Parser tests for SQL dump formats and table-prefix detection.
- Sanitizer tests for disallowed tags, attributes, protocols, PHP fragments, shortcodes, hidden payloads, and safe allowed editorial HTML.
- Media tests for signature validation, double extensions, symlink/traversal rejection, Sharp re-encoding, hash deduplication, and missing files.
- Route tests for permalink structures, nested pages, collisions, trailing slash behavior, redirects, and internal links.
- SEO tests for metadata sanitization and canonical-domain validation.
- Playwright tests for generated routes, rendering, navigation, search, archives, 404, and accessibility smoke checks.

Validation:

- Added `zod` to the isolated `tools/wordpress-recovery/` utility package.
- Implemented `tools/wordpress-recovery/src/content-model.ts` with schemas for articles, pages, authors, taxonomy terms, safe content, SEO content fields, media assets, route manifest entries, review report entries, and the generated content bundle.
- Implemented `tools/wordpress-recovery/src/content-model-cli.ts` and `npm run content`.
- Added `tools/wordpress-recovery/test/content-model.test.ts` for bundle generation, noindex exclusion, unsafe-content exclusion, and file output.
- `npm test` passed 48/48 tests.
- Real content generation wrote validated file-based content under `content/`.
- Generated 528 article files, 24 page files, 3 authors, 17 categories, 0 tags, and 552 routes.
- Excluded 6,516 records by default, primarily noindex/spam-suspect records plus 7 schema-failing records recorded in `content/reports/validation-warnings.json`.
- Targeted scan found no `<script`, `<iframe`, `javascript:`, `data:text/html`, PHP fragments, inline event-handler attributes, `wp-admin`, or `wp-login` patterns in `content/content-bundle.json`.
