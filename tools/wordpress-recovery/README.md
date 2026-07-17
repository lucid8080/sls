# WordPress Recovery Utility

Read-only extraction tool for approved WordPress SQL dumps.

## Security Boundary

This utility:

- Reads `.sql`, `.sql.gz`, or `.zip` files containing SQL.
- Parses only the required WordPress logical tables for content recovery.
- Does not start WordPress.
- Does not execute PHP.
- Does not start MySQL.
- Does not import the database.
- Does not read themes, plugins, WordPress core, or quarantined application folders.
- Processes media files only when the separate media scanner is run against an approved uploads directory.
- Does not sanitize article HTML yet.

Raw extracted content must be treated as untrusted and passed through the sanitizer/conversion phases before it is used in React or published.

## Usage

```bash
npm install
npm test
npm run extract -- --input "path/to/dump.sql" --out "path/to/output"
```

Optional explicit prefix:

```bash
npm run extract -- --input "path/to/dump.sql" --out "path/to/output" --prefix "r14_"
```

Media scan:

```bash
npm run media -- --input "path/to/approved-uploads" --out "path/to/recovered-media-output"
```

Optional media settings:

```bash
npm run media -- --input "path/to/approved-uploads" --out "path/to/recovered-media-output" --max-bytes 26214400 --no-pdf
```

Sanitize extracted published content from a dump:

```bash
npm run sanitize -- --input "path/to/dump.sql" --out "path/to/sanitized-content-output" --site-url "https://example.com"
```

Convert WordPress formatting and then sanitize:

```bash
npm run format -- --input "path/to/dump.sql" --out "path/to/formatted-content-output" --site-url "https://example.com"
```

Generate route manifest and redirects:

```bash
npm run routes -- --input "path/to/formatted-content-output/sanitized-content.json" --site-url "https://example.com" --permalink "/%postname%/" --out "path/to/route-output" --project-root "path/to/project"
```

Generate SEO metadata and static SEO files:

```bash
npm run seo -- --sql "path/to/dump.sql" --content "path/to/formatted-content-output/sanitized-content.json" --routes "path/to/data/route-manifest.json" --site-url "https://example.com" --out "path/to/seo-output" --project-root "path/to/project"
```

Rewrite internal links:

```bash
npm run links -- --content "path/to/formatted-content-output/sanitized-content.json" --routes "path/to/data/route-manifest.json" --site-url "https://example.com" --out "path/to/link-output" --project-root "path/to/project" --media-prefix "/media/"
```

Generate validated file-based content:

```bash
npm run content -- --content "path/to/data/linked-content.json" --seo "path/to/data/seo-metadata.json" --routes "path/to/data/route-manifest.json" --out "path/to/content"
```

## Outputs

- `published-content.json` contains published `post` and `page` rows only.
- `attachments.json` contains attachment records and attachment-file metadata only; files are not copied or validated here.
- `summary.json` contains source and count information.
- `reports/non-public-content.json` reports drafts, private content, revisions, menu items, and other non-public entries.
- `reports/custom-post-types.json` reports custom post types that are not published automatically.
- `reports/orphaned-attachments.json` reports attachments not associated with a published post or page.

Media scan outputs:

- `media/` contains accepted raster images decoded and re-encoded by Sharp.
- `reports/media-accepted.json` lists accepted files, hashes, dimensions, and output paths.
- `reports/media-rejected.json` lists rejected files with reasons, severities, escaped previews, and manual-review flags.
- `reports/media-missing.json` is reserved for later SQL attachment-to-file mapping.
- `reports/media-duplicates.json` lists duplicate files by content hash.

Sanitizer outputs:

- `sanitized-content.json` contains sanitized published posts/pages only. It does not include raw recovered HTML.
- `reports/removed-content.json` lists removed elements, attributes, shortcodes, comments, and unsafe URLs.
- `reports/suspicious-links.json` lists external, suspicious, malformed, or HTTP links for policy review.
- `reports/suspicious-html.json` lists executable-looking raw HTML findings.

Formatter outputs:

- `sanitized-content.json` contains formatting-converted and sanitized published posts/pages.
- `reports/unknown-shortcodes.json` lists shortcodes that were not executed and require review.
- `reports/formatting-warnings.json` lists formatting conversions that need review, such as galleries or embeds that could not be converted.
- The sanitizer reports are also written for the formatted content.

Route outputs:

- `data/route-manifest.json` contains original absolute URLs, original pathnames, new pathnames, canonical paths, content types, status expectations, redirect flags, and review flags.
- `data/redirects.json` contains permanent redirect entries when exact path preservation is impossible.
- `reports/route-collisions.json` lists any duplicate path collisions for manual review.
- `route-output/` contains the same route artifacts when `--out` is provided.

SEO outputs:

- `data/seo-metadata.json` contains sanitized Metadata API-ready records, canonical URLs, Open Graph/Twitter data, taxonomy data, and structured-data objects.
- `sitemap.xml`, `robots.txt`, and `rss.xml` are written at the project root.
- `reports/seo-review.json` lists rejected suspicious metadata, noindex decisions, bad canonicals, and other SEO items needing manual review.
- `seo-output/` contains the same SEO artifacts when `--out` is provided.

Link outputs:

- `data/linked-content.json` contains formatted/sanitized content with internal article links rewritten to canonical paths.
- `data/link-summary.json` summarizes rewritten, preserved external, broken internal, and suspicious external links.
- `reports/broken-internal-links.json` lists unresolved internal links for manual review. Old `wp-admin` links are neutralized in rewritten content and reported as high severity.
- `reports/suspicious-external-links.json` lists external destinations that match suspicious domain/path patterns.
- `link-output/` contains the same link artifacts when `--out` is provided.

Content model outputs:

- `content/content-bundle.json` contains the validated production content bundle.
- `content/articles/` contains one JSON file per validated article.
- `content/pages/` contains one JSON file per validated page.
- `content/authors/`, `content/categories/`, and `content/tags/` contain normalized taxonomy files.
- `content/routes.json` contains routes only for content that passed validation and publication filters.
- `content/reports/excluded-content.json` lists noindex and schema-excluded records.
- `content/reports/validation-warnings.json` lists records that failed schema validation or were missing required companion artifacts.
- `content/summary.json` summarizes the generated collection counts.
