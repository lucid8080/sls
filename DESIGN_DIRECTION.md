# Design Direction

Status: Phase 9 draft, pending user confirmation.

This direction is based on the recovered, sanitized, and link-rewritten editorial corpus. It does not copy the compromised WordPress theme, plugin layouts, demo pages, JavaScript, CSS, or recovered theme-demo styling.

## Editorial Positioning

Simple Life Saver should feel like a practical, trustworthy guide for making home life easier. The recoverable indexable content clusters around smart cooking, home care, smart cleaning, robot vacuums, appliances, travel preparation, checklists, and buyer-friendly comparisons.

The new site should present this as a calm, modern editorial brand:

- Useful household guidance without clutter.
- Clear answers for everyday problems.
- Product and appliance content that feels tested, careful, and transparent.
- A reading experience that prioritizes comprehension over ads, widgets, and theme gimmicks.

## Audience

Primary readers are people looking for practical answers before buying, cleaning, cooking, troubleshooting, or organizing around the home.

Design implications:

- Use direct headings, short summaries, and visible article metadata.
- Prioritize mobile reading and search.
- Make categories easy to scan by real-life task: cook, clean, maintain, compare, prepare.
- Avoid dense sidebars and intrusive calls to action.

## Visual Direction

Use a premium but approachable editorial style.

Suggested visual language:

- Background: warm off-white or very light neutral.
- Text: high-contrast charcoal.
- Accent: practical green, muted teal, or warm amber for action states and category marks.
- Surfaces: subtle cards with soft borders, not heavy shadows.
- Photography: recovered media where validated and relevant; otherwise use neutral brand placeholders clearly marked for replacement.
- Icons: simple line icons only where they improve scanning.

Avoid:

- Generic WordPress magazine grids.
- Busy demo-homepage modules.
- Fake testimonials, fake ratings, or invented review claims.
- Heavy animation.
- Low contrast gray text.
- Ad-like buttons or cluttered affiliate styling.

## Typography

Use a readable editorial type system:

- Body: modern sans-serif optimized for long reading.
- Headings: confident sans-serif with strong hierarchy.
- Article width: approximately 680-760px for body copy.
- Line height: comfortable for mobile and desktop.
- Code/table/list styles: simple, legible, and responsive.

Recommended implementation:

- Use `next/font` for locally hosted fonts.
- Keep font weights minimal to reduce payload.
- Support responsive text sizing with Tailwind utility tokens.

## Page Experience

The homepage should act as a useful guide hub, not a theme demo.

Recommended homepage structure:

- Skip-to-content link.
- Header with logo placeholder, primary nav, and search.
- Hero area featuring one strong indexable guide.
- Topic cards for Smart Cooking, Home Care, Smart Cleaning, Robot Vacuums, Appliances, and Travel.
- Latest articles section.
- Practical guides section for evergreen content.
- Newsletter call-to-action with no provider wired until configured.
- Footer with essential navigation, RSS, privacy/contact links if recovered or supplied.

Article pages should include:

- Breadcrumbs.
- Title and sanitized excerpt.
- Author, published date, modified date, category, and reading time.
- Featured image when validated and mapped.
- Table of contents for long articles.
- Comfortable body layout.
- Safe related articles.
- Tracker-free share links.
- Disclosure placeholder for affiliate/product content if the user supplies final wording.

Archive pages should include:

- Category introduction.
- Article cards with title, excerpt, date, and category.
- Pagination or static segmented lists.
- No tag pages unless the recovered tag has useful public content.

## Navigation

Initial primary navigation should favor high-signal recovered categories:

- Smart Cooking
- Home Care
- Smart Cleaning
- Robot Vacuums
- Appliances
- Travel

Secondary/footer navigation can include:

- Latest Articles
- Categories
- Authors
- RSS
- Search
- Contact or About only if legitimate content is recovered or supplied.

Do not include recovered WordPress admin, theme-demo, plugin, casino/spam, or noindex content in navigation.

## Components

Build reusable components with minimal client JavaScript:

- `SiteHeader`
- `SiteFooter`
- `SearchBox`
- `ArticleCard`
- `FeaturedArticle`
- `TopicCard`
- `Breadcrumbs`
- `TableOfContents`
- `ReadingTime`
- `ShareLinks`
- `NewsletterCta`
- `RelatedArticles`
- `ResponsiveImage`
- `Custom404`

Client-side behavior should be limited to search interactions, mobile menu toggling, and progressive enhancements that cannot be done statically.

## Accessibility And Performance

The design should support Phase 10 from the start:

- Semantic landmarks.
- Visible focus states.
- Keyboard-accessible menus.
- Strong color contrast.
- Reduced-motion support.
- Responsive images through Next.js Image where local dimensions are known.
- Lazy loading below-the-fold imagery.
- Minimal layout shift.
- Static generation for articles and archives.
- No invasive third-party trackers.

## Brand Asset Placeholders

Missing brand assets should be represented with neutral placeholders:

- Logo placeholder: text mark `Simple Life Saver`.
- Favicon placeholder: simple initials or house/check mark concept.
- Newsletter provider: disabled placeholder form until configured.
- Affiliate disclosure: placeholder requiring user-approved final text.

Every placeholder must be clearly marked in code/content so it is not mistaken for final production copy.
