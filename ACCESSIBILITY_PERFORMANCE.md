# Accessibility And Performance

Status: Phase 10 standard, pending user confirmation.

This document defines the accessibility and performance requirements for the future Next.js rebuild. It is intentionally implementation-focused, but no old WordPress theme, plugin, JavaScript, CSS, PHP, or runtime behavior should be reused.

## Accessibility Target

The rebuilt site should meet practical WCAG 2.2 AA expectations for an editorial website.

Minimum acceptance criteria:

- Pages use semantic landmarks: `header`, `nav`, `main`, `article`, `aside` where appropriate, and `footer`.
- Every page has exactly one visible or programmatic `h1`.
- Heading levels do not skip for layout reasons.
- A skip-to-content link is the first focusable control on every page.
- Keyboard users can reach and operate navigation, search, share controls, newsletter placeholder, pagination, and mobile menu controls.
- Focus indicators are visible, high-contrast, and not removed by CSS resets.
- Color contrast meets AA for text, links, controls, focus states, and muted metadata.
- Links are visually distinguishable without relying only on color inside article content.
- Form controls have visible labels or accessible names.
- Error/help text is connected to fields with accessible descriptions.
- Menus use real buttons for toggles and expose expanded/collapsed state.
- Motion respects `prefers-reduced-motion`.
- Images use meaningful alt text when editorial and empty alt text when decorative.
- Tables are responsive and retain semantic table markup.
- The custom 404 page is navigable, searchable, and does not redirect users unexpectedly.

## Page-Level Requirements

Homepage:

- Start with skip link, site header, primary navigation, and `main`.
- Use one `h1` that describes the site value.
- Topic cards must be keyboard reachable and have clear names.
- Featured and latest article cards must expose title, category, date, and destination.

Article pages:

- Use an `article` landmark inside `main`.
- Include breadcrumbs before the article heading.
- Preserve logical heading order from sanitized content.
- Render publication and modified dates with machine-readable `datetime` values.
- Provide a table of contents only when there are enough headings to justify it.
- Related articles should be after the main article body.
- Share controls must be plain links or buttons without tracker scripts.

Archive pages:

- Use a descriptive `h1`.
- Article lists should be real lists or structured card grids with accessible links.
- Pagination must be link-based and expose current page state.

Search page:

- Search input must have a label.
- Result counts should be announced in normal page text.
- Empty states should suggest category links.
- Local static search should not block initial page rendering.

Newsletter placeholder:

- Must clearly state that no provider is connected yet.
- Must not collect or submit email addresses until a provider and privacy copy are configured.

## Media Accessibility

Use only validated and re-encoded media from the approved media pipeline.

Rules:

- Use recovered alt text only after sanitization and review.
- Prefer empty `alt=""` for decorative images.
- Do not invent product claims, credentials, ratings, or author expertise.
- Captions should be rendered as visible text near the image.
- Images that function as links need an accessible name that describes the link target.
- Avoid text embedded in images unless the text is duplicated in HTML.

## Performance Target

The rebuild should be optimized for static generation and low JavaScript.

Minimum acceptance criteria:

- Articles, pages, category archives, author archives, and static SEO files are generated at build time wherever practical.
- No database is required at runtime.
- Client components are limited to search interaction, mobile navigation, and other necessary progressive enhancements.
- Article body rendering is server-rendered.
- Fonts are loaded with `next/font` and minimal weights.
- Images use `next/image` or precomputed responsive image metadata where dimensions are known.
- Below-the-fold images lazy load.
- Layout reserves image dimensions to avoid cumulative layout shift.
- Third-party scripts are excluded by default.
- Newsletter, analytics, and affiliate integrations remain disabled until explicitly configured.
- No recovered WordPress JavaScript, CSS, or tracking snippets are reused.

## Core Web Vitals Budget

Initial targets for representative pages:

- Largest Contentful Paint: under 2.5 seconds on a normal mobile connection.
- Cumulative Layout Shift: under 0.1.
- Interaction to Next Paint: under 200 milliseconds for interactive controls.
- Initial JavaScript for article pages should stay minimal; article content should not require hydration.

These are targets for implementation and verification once the Next.js app exists.

## Rendering Strategy

Use static generation by default:

- Generate routes from validated local content artifacts.
- Generate sitemap, RSS, and robots outputs from the recovery pipeline.
- Use server components for layout, article pages, archives, related content, breadcrumbs, and metadata.
- Use client components only for local search, menu toggles, and small interactive controls.

Avoid:

- Runtime database calls.
- Client-rendered article bodies.
- Heavy animation libraries.
- Third-party embeds by default.
- Ad networks or trackers during the rebuild.

## CSS And Design Implementation

Tailwind should define accessibility-friendly tokens:

- Color tokens with AA contrast-tested pairs.
- Focus ring tokens shared across controls.
- Fluid typography scale.
- Comfortable article measure.
- Reduced-motion variants.
- Responsive spacing tokens.

Implementation rules:

- Do not remove outlines globally.
- Use `:focus-visible` for enhanced focus styling.
- Use underline or another non-color cue for article-body links.
- Keep dark mode out unless it is implemented and tested fully.

## Testing Gates

Before launch, run:

- Type checking.
- ESLint.
- Unit tests for content validation, route generation, SEO generation, media validation, and link rewriting.
- Playwright smoke tests for homepage, article page, category archive, search, 404, keyboard navigation, and mobile menu.
- Automated accessibility checks in Playwright where possible.
- Lighthouse or equivalent checks for representative homepage, article, archive, search, and 404 pages.

Manual checks:

- Keyboard-only navigation.
- Screen reader spot check for homepage and article page.
- Mobile viewport review.
- Reduced-motion review.
- Color contrast review.
- Broken internal link report reviewed or accepted.
- Suspicious external link report reviewed or accepted.

## Implementation Blockers

The Next.js application has not been scaffolded yet, so these standards cannot be fully verified against rendered pages in this phase.

Phase 10 is considered ready for user confirmation when this standard exists and is referenced by the migration plan. Full pass/fail validation belongs to the Next.js implementation and Playwright/Lighthouse phases.
