# Recovery Inventory

Status: Phase 1 SQL inventory completed; media inventory remains blocked.

This inventory is based on a read-only workspace scan and direct SQL dump parsing. No WordPress runtime was started, no PHP was executed, no database was imported, and no recovered application code was read or reused.

## Approved Input Status

| Item | Status | Notes |
| --- | --- | --- |
| SQL dump path | Found | `sls-bkup/sls_database/upgradn1_WPI90.sql/upgradn1_WPI90.sql` |
| SQL compression format | Plain SQL | The user-supplied path is a directory containing the actual `.sql` file. |
| Separately copied uploads directory | Found | `approved-uploads` |
| Manual domain name | Inferred from SQL | `https://simplelifesaver.com` from `siteurl` and `home`; user confirmation still recommended. |
| Manual permalink structure | Recovered from SQL | `/%postname%/` from `permalink_structure`. |
| Remote image retrieval | Disabled | Offline-only unless explicitly enabled by the user. |

## SQL Dump Metadata

| Item | Result |
| --- | --- |
| Database name | `upgradn1_WPI90` |
| Dump generation time | Jul 15, 2026 at 01:30 PM |
| SQL server version comment | `5.7.44-48` |
| phpMyAdmin PHP version comment | `8.3.31` |
| File size | 107,587,410 bytes |
| Total tables in dump | 124 |
| Non-WordPress table examples | `ip2nation`, `ip2nationCountries` |

## Discovered Untrusted Material

The workspace contains `sls-bkup`, including quarantined WordPress paths such as `sls-bkup/wp-content__acfa4f0`. These folders match the project’s explicit untrusted-folder examples and must not be used as migration inputs.

Observed untrusted upload-tree filenames include unsafe or non-editorial extensions such as `.php`, `.htaccess`, `.js`, `.css`, `.json`, `.xml`, `.CSV`, and logs. These observations are enough to exclude the tree from approved media recovery; payload contents were not opened or reproduced.

A `wp-config.php` filename was observed inside an untrusted theme path. It was not opened and must not be copied or reused.

## Database Inventory

Direct parsing found the WordPress table prefix `r14_`.

| Required Item | Result |
| --- | --- |
| WordPress table prefix | `r14_` |
| WordPress database version | `db_version = 61833`, `initial_db_version = 44719` |
| Relevant tables | `r14_posts`, `r14_postmeta`, `r14_terms`, `r14_term_taxonomy`, `r14_term_relationships`, `r14_users`, `r14_usermeta`, `r14_options` |
| Number of published posts | 7,043 |
| Number of published pages | 25 |
| Number of attachments | 891 |
| Number of categories | 20 total; 17 non-empty |
| Number of tags | 19 total; 0 non-empty by stored taxonomy count |
| Number of users/authors | 5 exported users; `author` taxonomy has 6 terms, 3 non-empty |
| WordPress permalink configuration | `/%postname%/` |
| Old site URL | `https://simplelifesaver.com` |
| Old home URL | `https://simplelifesaver.com` |
| Installed SEO plugin metadata | Yoast metadata present; Rank Math metadata and tables present; All in One SEO metadata not detected |
| Suspicious database content | High-volume findings requiring sanitizer/report review; see findings below |
| Suspicious URLs/domains | External/affiliate/theme/plugin domains present; see findings below |
| Suspicious administrator accounts | Three real exported administrators plus a high-severity trigger that can create a `webclient` administrator |

## Content Counts

| Type / Status | Count |
| --- | ---: |
| `post` / `publish` | 7,043 |
| `post` / `draft` | 92 |
| `post` / `auto-draft` | 1 |
| `page` / `publish` | 25 |
| `page` / `draft` | 3 |
| `page` / `private` | 1 |
| `attachment` / `inherit` | 891 |
| `revision` / `inherit` | 363 |
| `nav_menu_item` / `publish` | 11 |
| `oembed_cache` / `publish` | 292 |
| Other custom post types | Present; must be reported, not published automatically |

Custom post types observed include `x-portfolio`, `tablepress_table`, `pretty-link`, `wp-story`, `wp_block`, `wp_global_styles`, `wpcode`, `sp_wp_carousel`, `aawp_table`, `elementor_library`, `wpcf7_contact_form`, `rb-etemplate`, `mc4wp-form`, `ppma_boxes`, `ppmacf_field`, and `wp_navigation`.

## SEO Metadata

Yoast metadata keys were detected, including SEO title, meta description, primary category, content score, estimated reading time, schema article type, and noindex/nofollow flags.

Rank Math metadata was detected, including SEO score, primary category, rich snippet data, focus keyword, and description. Rank Math tables are present for 404 logs, internal links, internal metadata, redirections, redirection cache, and search console analytics.

All in One SEO metadata was not detected in the inspected postmeta keys.

## Security Findings

- A database trigger named `after_insert_comment` can create a `webclient` administrator when a matching comment is inserted. This is a high-severity persistence mechanism and must not be migrated.
- Real exported administrator logins are `admin`, `DreNation`, and `jamor`. Confirm which, if any, should become authors in the new site; no WordPress credentials or roles should migrate.
- The broad SQL content scan flagged 16,272 suspicious or review-worthy values. Many are expected unsafe WordPress artifacts such as oEmbed iframes, serialized plugin data, tracking snippets, and option values, but they still require sanitizer-driven removal or conversion.
- Header/footer option values include script-tag tracking snippets. These must not migrate.
- Serialized plugin option values and objects are present. They must not be deserialized with unsafe PHP object handling.
- Plugin/security tables include Wordfence, Rank Math, Slider Revolution, Pretty Links, MainWP, Action Scheduler, Ezoic, Hustle, ShortPixel, Smush, and affiliate/link-management tables. These are not editorial content sources and must not be imported wholesale.

## Sanitizer Output

The Phase 3 sanitizer wrote controlled output under `sanitized-content-output/`.

| Sanitizer Result | Count |
| --- | ---: |
| Sanitized published posts/pages | 7,068 |
| Removed-content report entries | 29,646 |
| Suspicious-link report entries | 1,825 |
| Suspicious-HTML report entries | 0 |

The sanitized content artifact omits raw recovered HTML and does not contain literal matches for checked dangerous patterns such as `<script`, `<iframe`, `javascript:`, event handlers, PHP fragments, or `data:text/html`.

## Formatting Conversion Output

The Phase 4 formatter wrote controlled output under `formatted-content-output/`.

| Formatter Result | Count |
| --- | ---: |
| Formatted and sanitized posts/pages | 7,068 |
| Unknown-shortcode report entries | 80 |
| Formatting-warning report entries | 0 |
| Removed-content report entries | 29,608 |
| Suspicious-link report entries | 1,825 |
| Suspicious-HTML report entries | 0 |

The formatted content artifact passed targeted checks for leftover Gutenberg wrappers, caption/gallery/embed shortcodes, iframes, scripts, unsafe protocols, event handlers, PHP fragments, and `data:text/html`.

Unknown shortcode examples include TablePress shortcodes such as `[table id=...]`, editorial placeholders like `[insert link]`, and domain-specific abbreviations like `[QR]` and `[NPR]`. These require manual review because shortcodes were not executed.

## Route Manifest Output

The Phase 6 route generator wrote project-level outputs under `data/` and `reports/`, plus a duplicate review copy under `route-output/`.

| Route Result | Count |
| --- | ---: |
| Route manifest entries | 7,068 |
| Redirect entries | 0 |
| Route collisions | 0 |
| Review-required route entries | 2 |

All public content paths were preserved with the recovered `/%postname%/` structure and trailing slashes. No homepage catch-all redirects were generated.

The two review-required entries have unusual replacement-character suffixes that were URL-encoded in the manifest.

## SEO Metadata Output

The Phase 7 SEO generator wrote project-level outputs at `data/seo-metadata.json`, `sitemap.xml`, `robots.txt`, `rss.xml`, and `reports/seo-review.json`, plus a duplicate review copy under `seo-output/`.

| SEO Result | Count |
| --- | ---: |
| SEO metadata records | 7,068 |
| Indexable sitemap URLs | 559 |
| Noindex metadata records | 6,509 |
| SEO review entries | 19,058 |

The high noindex count is intentional for safety: the recovered database contains thousands of gambling/casino/pokies/slot-style spam entries. Those entries were excluded from sitemap and RSS and recorded for manual review.

Targeted checks found no literal executable patterns in SEO metadata and no casino/pokies/slots/blackjack/real-money/bonus-code matches in sitemap or RSS.

## Internal Link Rewrite Output

The Phase 8 link rewriter wrote project-level outputs at `data/linked-content.json`, `data/link-summary.json`, `reports/broken-internal-links.json`, and `reports/suspicious-external-links.json`, plus a duplicate review copy under `link-output/`.

| Link Result | Count |
| --- | ---: |
| Formatted/sanitized articles processed | 7,068 |
| Internal/media links rewritten | 28,242 |
| External links preserved | 1,697 |
| Broken internal links requiring review | 130 |
| Suspicious external links requiring review | 111 |

The rewriter handles old-domain absolute URLs across HTTP/HTTPS and `www` variants, URL-encoded paths, trailing-slash variants, relative links, anchors, WordPress `?p=`/`?page_id=` links, and old uploads media paths. Old `wp-admin` links were neutralized in rewritten content and reported as high severity rather than preserved as live links.

The remaining suspicious external links include neutralized external WordPress admin links from theme-demo content and casino-domain links in spammy recovered content. Remaining broken internal links include category/search/archive-style targets, unpublished or missing slugs, and old WordPress admin URLs requiring manual review.

## Design And Content Architecture Output

The Phase 9 planning pass created `DESIGN_DIRECTION.md` and `CONTENT_ARCHITECTURE.md`.

The design direction positions the rebuilt site as a practical, trustworthy home/lifestyle editorial guide rather than a copy of the compromised WordPress theme. It is based on indexable recovered content clusters including Lifestyle, Smart Cooking, Home Care, Smart Cleaning, Robot Vacuums, Appliances, Travel, Air Quality, and buyer/checklist content.

The content architecture defines file-based collections for articles, pages, authors, categories, tags, and validated media. It uses `data/linked-content.json`, `data/route-manifest.json`, and `data/seo-metadata.json` as controlled source artifacts, with reports used as manual review gates before launch.

## Accessibility And Performance Output

The Phase 10 pass created `ACCESSIBILITY_PERFORMANCE.md`.

This document defines the rebuild standard for practical WCAG 2.2 AA behavior, static generation, minimal client JavaScript, optimized fonts/images, Core Web Vitals targets, keyboard navigation, visible focus, skip link behavior, accessible menus/forms, media alt-text rules, reduced motion, and testing gates.

Full rendered-page validation remains blocked until the Next.js application is scaffolded and page templates exist.

## Content Model Output

The Phase 11 content model generator wrote validated file-based output under `content/`.

| Content Model Result | Count |
| --- | ---: |
| Article files | 528 |
| Page files | 24 |
| Authors | 3 |
| Categories | 17 |
| Tags | 0 |
| Routes | 552 |
| Excluded records | 6,516 |
| Validation warnings | 7 |

The generated content uses Zod-validated schemas for articles, pages, authors, taxonomy terms, safe HTML content, SEO fields, route manifest entries, media asset shape, review report shape, and the final bundle. By default, noindex records are excluded rather than published.

Seven otherwise indexable records were excluded because strict safe-content validation found blocked executable or WordPress-admin patterns. The details are in `content/reports/validation-warnings.json`.

A targeted scan found no `<script`, `<iframe`, `javascript:`, `data:text/html`, PHP fragments, inline event-handler attributes, `wp-admin`, or `wp-login` patterns in `content/content-bundle.json`.

## URL and Domain Findings

The primary SQL `siteurl` and `home` values are `https://simplelifesaver.com`.

Common non-internal domains found in SQL values include Amazon domains, `amzn.to`, YouTube, theme/plugin vendor domains, Gravatar, Reddit, Unsplash, WordPress.org, affiliate redirect domains, and social networks. These require allowlist/manual review during link sanitization and internal-link rewriting.

## Media Inventory

Approved media source: `approved-uploads`.

The quarantined `sls-bkup/wp-content__acfa4f0/uploads` tree is not considered the approved source and remains excluded. The approved media source for this scan is the separate `approved-uploads` directory.

The media scanner wrote controlled output under `recovered-media-output/`. Source files were not modified.

| Media Scanner Result | Count |
| --- | ---: |
| Accepted files | 7,268 |
| Rejected files | 14 |
| Duplicate files | 1,903 |
| Missing files | 0 |

| Accepted Source Type | Count |
| --- | ---: |
| JPEG | 6,578 |
| PNG | 559 |
| WebP | 118 |
| GIF | 10 |
| PDF | 3 |

Rejected files include `.php`, `.htaccess`, `.CSV`, `.xlsx`, `.mp4`, and an oversized `copy.zip`. These were reported but not copied into accepted media output.

The counts below come from attachment rows in the SQL dump and are useful for later media-to-post mapping; they are not filesystem validation results.

| SQL Attachment MIME Type | Count |
| --- | ---: |
| `image/jpeg` | 780 |
| `image/png` | 83 |
| `image/webp` | 19 |
| `image/gif` | 3 |
| `application/pdf` | 3 |
| `video/mp4` | 2 |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | 1 |

| SQL Attachment Extension | Count |
| --- | ---: |
| `.jpg` | 770 |
| `.jpeg` | 10 |
| `.png` | 83 |
| `.webp` | 19 |
| `.gif` | 3 |
| `.pdf` | 3 |
| `.mp4` | 2 |
| `.xlsx` | 1 |

Only JPEG, PNG, WebP, GIF, and optionally validated PDFs are eligible for the future media pipeline. MP4 and XLSX are not approved production media types under the current requirements.

## Remaining Phase 1 Blocker

Phase 1 SQL parsing and filesystem media scanning succeeded.

Remote image retrieval remains disabled unless explicitly enabled by the user.
