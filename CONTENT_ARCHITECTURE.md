# Content Architecture

Status: Phase 9 draft, pending user confirmation.

This architecture uses only recovered artifacts produced by the secure recovery pipeline. It does not depend on WordPress, PHP, MySQL, old themes, old plugins, recovered JavaScript, recovered CSS, or unsanitized database values.

## Source Artifacts

The production content model should be generated from these controlled artifacts:

- `data/linked-content.json` for sanitized article/page body content with rewritten internal links.
- `data/route-manifest.json` for preserved canonical paths.
- `data/seo-metadata.json` for sanitized SEO metadata, taxonomy data, authors, dates, canonical paths, and noindex flags.
- `reports/broken-internal-links.json` for manual review before launch.
- `reports/suspicious-external-links.json` for manual review before launch.
- `reports/media-accepted.json` for validated media candidates.
- `reports/media-rejected.json` for files that must never be deployed.

The production site should exclude or quarantine records marked `noindex` unless the user intentionally restores a reviewed item.

## Primary Collections

Create file-based collections for:

- Articles: indexable published posts.
- Pages: legitimate recovered pages after review.
- Authors: recovered author identities after user approval.
- Categories: recovered categories with useful public content.
- Tags: only if they have meaningful reviewed content.
- Media: re-encoded and validated images/PDFs only.
- Reports: non-production review artifacts.

Recommended production paths:

- `content/articles/*.json`
- `content/pages/*.json`
- `content/authors/*.json`
- `content/categories/*.json`
- `content/tags/*.json`
- `public/media/YYYY/MM/*`

Use JSON or another non-executable structured format for recovered content. Do not generate executable MDX from recovered HTML.

## Editorial Scope

The indexable recovered content supports a practical home/lifestyle editorial site.

Top public categories from the recovered indexable set:

- Lifestyle
- Smart Cooking
- Home Care
- Smart Cleaning
- Blog
- Multi Function
- Robot Vacuums
- Flooring
- Comparisons
- Appliances
- Travel
- Air Quality

Recommended public topic grouping:

- Smart Cooking: Instant Pot, kitchen appliances, cooking troubleshooting, meal preparation.
- Home Care: household maintenance, organization, practical home fixes.
- Smart Cleaning: cleaning tools, robot vacuums, floor care, appliance cleaning.
- Appliances: product usage guides and comparisons.
- Travel: packing, luggage, preparation, travel utility content.
- Buying Guides: buyer-focused and comparison content where metadata/content is clean.

The generic `Blog` and `Multi Function` categories should be reviewed during implementation. They may be preserved for URL compatibility but presented under clearer labels in navigation when appropriate.

## Route Strategy

Use the route manifest as the source of truth:

- Preserve article and page paths exactly where possible.
- Use `canonicalPath` from `data/route-manifest.json`.
- Do not create homepage catch-all redirects.
- Use `data/redirects.json` only for explicit redirect entries.
- Render a real custom 404 page for missing content.

Initial route templates:

- `/` homepage.
- `/<post-slug>/` article detail pages from preserved canonical paths.
- `/category/[slug]/` category archives.
- `/tag/[slug]/` tag archives only for reviewed meaningful tags.
- `/author/[slug]/` author archives only for approved authors.
- `/search/` search page.
- `/rss.xml`, `/sitemap.xml`, and `/robots.txt` from generated SEO artifacts.

## Page Types

Homepage:

- Featured article.
- Topic navigation.
- Latest indexable articles.
- Evergreen guide sections.
- Newsletter CTA placeholder.

Article page:

- Breadcrumbs.
- Title, excerpt, author, dates, category.
- Reading time.
- Featured image if validated and mapped.
- Sanitized body content.
- Table of contents for long articles.
- Related articles from same category/topic.
- Tracker-free share links.

Category archive:

- Category title and optional description.
- Indexable articles in reverse chronological order.
- Static pagination if needed.

Author archive:

- User-approved author name and slug.
- No credentials, roles, emails, bios, avatars, or claims should be invented.
- Include posts only for approved authors.

Search:

- Static local index generated from indexable article title, excerpt, category, and safe body text.
- No remote search provider by default.
- Exclude noindex, spam, admin/demo, and manually rejected records.

Custom 404:

- Helpful message.
- Search.
- Links to top categories.
- No redirect to homepage.

## Related Content

Related article logic should be deterministic and static:

- Prefer same category.
- Then shared topic group.
- Then recent indexable articles.
- Exclude current article.
- Exclude noindex or suspicious records.
- Do not use recovered plugin recommendations or database-generated related-post tables.

## Navigation Model

Primary navigation:

- Smart Cooking
- Home Care
- Smart Cleaning
- Robot Vacuums
- Appliances
- Travel

Footer navigation:

- Latest Articles
- Categories
- Authors
- Search
- RSS
- Privacy/Contact/About only when reviewed or supplied.

Navigation should be generated from reviewed category/page definitions, not from recovered WordPress menu items.

## Content Quality Rules

Before an item is included in production:

- `noindex` must be false unless the user manually approves restoration.
- Title must not be spam, placeholder, or plugin-template residue.
- Paths must come from the route manifest.
- Body content must come from `data/linked-content.json`.
- Links must not include live `wp-admin`, `wp-login`, JavaScript URLs, unsafe data URLs, or unresolved internal links.
- Media must map to accepted/re-encoded files.

Manual review queues:

- `reports/broken-internal-links.json`
- `reports/suspicious-external-links.json`
- `reports/seo-review.json`
- `reports/unknown-shortcodes.json`
- `reports/media-rejected.json`

Known cleanup areas:

- Some recovered SEO titles contain template residue such as `%%page%%`; these should not appear in final visible titles without review.
- Theme-demo pages and demo links should not be promoted.
- Casino/spam content remains excluded by noindex and review reports.
- Old WordPress admin links are neutralized and should not be restored.

## Implementation Notes For Next.js

Use the App Router with static generation:

- Generate route params from the validated route/content manifest.
- Load article/page data from local files.
- Validate every content artifact with Zod before rendering.
- Render sanitized HTML through a constrained component that accepts only the already-sanitized representation.
- Keep interactive components isolated and minimal.

Suggested app structure:

- `app/(site)/page.tsx`
- `app/(site)/[...slug]/page.tsx`
- `app/(site)/category/[slug]/page.tsx`
- `app/(site)/author/[slug]/page.tsx`
- `app/(site)/search/page.tsx`
- `app/not-found.tsx`
- `lib/content/`
- `lib/seo/`
- `components/site/`
- `components/article/`

Production should have no WordPress runtime, no PHP runtime, and no database requirement.
