# Security Boundary

The compromised WordPress installation is an untrusted data source. The rebuild must recover editorial value without migrating application behavior, executable code, server configuration, or unsanitized content.

## Allowed Inputs

The recovery process may read only:

- A WordPress MySQL export in `.sql`, `.sql.gz`, or `.zip` format.
- A separately copied uploads media directory.
- A manually supplied domain name.
- A manually supplied permalink structure.

The process remains offline unless the user explicitly enables remote image retrieval.

## Disallowed Inputs

Do not use quarantined or renamed WordPress application folders as trusted sources, including:

- `wp-content__acfa4f0`
- `wp-admin__acfa4f0`
- `wp-includes__acfa4f0`
- Folders with random suffixes
- Quarantine folders
- Malware-cleanup backups
- Unknown WordPress core copies

Do not import, execute, copy, or reuse:

- PHP from the old website
- WordPress core files
- Old themes
- Old plugins
- Old JavaScript
- Old CSS
- `.htaccess`
- `wp-config.php`
- Cron files
- Shell scripts
- Unknown server configuration
- Node/package files from recovered directories

Do not rename quarantined WordPress folders back to their original names.

## Runtime Boundary

Never start or restore the old WordPress installation. Never require a PHP runtime or WordPress runtime for the production site. Avoid starting MySQL if direct SQL-dump parsing is practical.

The production rebuild should be a file-based Next.js App Router site with static generation wherever practical.

## Data Handling Boundary

Treat every database value, serialized value, shortcode, HTML fragment, URL, media attachment, and filename as potentially malicious.

The recovery tool must:

- Parse only required logical WordPress tables.
- Avoid unsafe PHP object deserialization.
- Never evaluate database content.
- Never insert recovered HTML directly into React.
- Never preserve scripts, event handlers, forms, unknown iframes, tracking snippets, injected links, PHP fragments, or executable encoded content.
- Escape short previews in reports so payloads are not reproduced as live HTML.

## Content Sanitization Boundary

Allowed editorial HTML must be explicit and narrow. Reasonable elements include paragraphs, headings, lists, blockquotes, code, tables, figures, captions, images, links, and horizontal rules.

Remove dangerous or non-editorial elements and attributes, including:

- `script`, `style`, `object`, `embed`, `form`, `input`, `button`, `textarea`, `select`, `meta`, and `link`
- `iframe` unless manually approved and converted to a safe component or canonical link
- SVG markup inside article HTML
- Inline event handlers such as `onclick`, `onerror`, `onload`, and `onmouseover`
- `javascript:`, `vbscript:`, executable `data:`, and local file URLs
- CSS expressions and hidden injected elements
- Suspicious tracking pixels
- Unknown shortcodes
- PHP fragments
- Base64-encoded executable content
- Comments containing suspicious payloads

Allowed URL protocols are limited to `https:`, `http:` when needed during migration and converted where possible, `mailto:`, and `tel:`.

## Media Boundary

Use only a separately supplied uploads media directory. Do not recursively trust the old `wp-content` directory.

Accept media only after validating actual file signatures, not only extensions. Allowed raster image types are JPEG, PNG, WebP, GIF, and AVIF where supported. PDFs may be accepted only into a separate downloads directory after validation.

Reject and report:

- PHP, `.phtml`, `.phar`, JavaScript, HTML, SVG by default, executables, and shell files
- Double extensions such as `photo.jpg.php`
- Signature/extension mismatches
- Polyglot files
- Suspicious trailing executable data
- Symlinks
- Path traversal
- Files above configurable size limits

Accepted raster images must be decoded and re-encoded with Sharp before production use.

## Reporting Boundary

Reports must include enough context for manual review without publishing live payloads:

- Post ID
- Post title
- Original path
- Reason
- Short escaped preview
- Severity
- Manual-review flag

Rejected content and rejected media must never be deployed.
