# Simple Life Saver: Agent Guide

This document gives AI agents a current, high-level map of the repository. It applies to the whole repository. Prefer the running code and tests over older planning documents when they disagree.

## Project Overview

Simple Life Saver is a secure rebuild of a previously compromised WordPress editorial site. The production application is a Next.js site with:

- A public, mostly statically generated content site.
- A password-protected CMS and administration area.
- File-backed recovered content merged with published CMS content.
- Scoped HTTP APIs for external AI/content agents.
- A separate offline WordPress recovery and sanitization toolchain.
- Vercel-oriented deployment, Neon PostgreSQL, and Vercel Blob media storage.

The old WordPress installation is an untrusted source. Never execute, import, or reuse its PHP, JavaScript, themes, plugins, CSS, server configuration, or runtime.

## Core Technology Stack

- Framework: Next.js 16 App Router.
- UI runtime: React 19.
- Language: strict TypeScript, ESM modules.
- Package manager: npm (`package-lock.json`).
- Styling: Tailwind CSS 4 through PostCSS plus substantial custom CSS in `app/globals.css` and `app/admin/admin.css`.
- Validation: Zod.
- Database: Neon serverless PostgreSQL.
- ORM/schema tooling: Drizzle ORM and Drizzle Kit.
- Authentication: NextAuth v5 beta, credentials provider, JWT sessions.
- Rich-text editing: Tiptap StarterKit.
- Image processing: Sharp.
- Managed uploads: Vercel Blob.
- Unit/integration tests: Vitest.
- Browser tests: Playwright with Chromium.
- Linting/formatting: ESLint 9 and Prettier.
- Hosting/operations: Vercel-compatible build, deploy hooks, and cron.

The main app does not declare a Node engine. Use a current Node.js LTS version. The separate recovery utility explicitly requires Node 20 or newer.

## High-Level Architecture

### Public Site

Public routes live mainly under `app/(site)/`:

- `/` displays featured and recent guides.
- `/[...slug]/` resolves preserved article and page paths.
- `/category/[slug]/` and `/author/[slug]/` provide archives.
- `/search/?q=...` performs in-memory substring search.
- `/rss.xml`, `/sitemap.xml`, and `/robots.txt` expose generated SEO artifacts.
- `/ads.txt` redirects to Ezoic Ads.txt Manager.

The `(site)` folder is a route group and does not appear in URLs. Public canonical paths normally include a trailing slash.

React Server Components are the default. Keep client components limited to interactions that genuinely need browser state, such as forms, editors, and ad lifecycle controls.

### Content Model

The public site is primarily file-backed:

- `content/content-bundle.json` is the validated recovered content bundle.
- `content/cms-export.json` contains published database articles exported for builds.
- `lib/content.ts` validates both sources, merges CMS articles over recovered articles by ID, filters unsafe/non-public records, and supplies search, archive, related-content, and route helpers.

The public filter in `lib/content.ts` is a critical security and publication boundary. It excludes `noindex` records, disallowed categories, and records matching gambling/spam terms. Do not weaken or bypass it casually; excluded records can still physically exist in generated JSON.

Recovered and CMS article bodies are sanitized HTML stored inside structured JSON. They are not MDX and must never become executable JSX.

### CMS and Admin

The protected admin surface lives under `app/admin/` and includes:

- Dashboard and article creation/editing/preview.
- Content calendar.
- Media management.
- YouTube embed cleanup.
- Advertising settings and placement previews.
- Agent API-key management.
- Autopilot and integration settings.

CMS route handlers are under `app/api/cms/`. Database code is under `lib/cms/`, with the schema in `lib/cms/db/schema.ts`.

The database stores articles, revisions, content-calendar entries, agent jobs, hashed API keys, publish logs, CMS settings, and media records.

Publishing is more than a status update: preserve sanitation, quality checks, revision/log behavior, CMS export, optional deploy-hook triggering, and notifications.

### Authentication and Agent APIs

Admin authentication is configured in `lib/auth.ts` and protected by middleware. CMS API handlers also perform their own session checks.

External agent endpoints live under `app/api/agent/v1/`. They use bearer keys whose SHA-256 hashes are stored in PostgreSQL. Available scopes include:

- `agent:read`
- `agent:write`
- `agent:publish`
- `agent:calendar`

Never log raw API keys, credentials, bearer tokens, webhook secrets, or database URLs. Keep authorization checks at each API boundary.

Other automation endpoints include:

- `/api/cron/daily-content`, protected by `CRON_SECRET`.
- `/api/telegram/webhook`, with optional webhook-secret validation.

Agent jobs can currently be created and read, but the HTTP workflow for marking jobs complete appears incomplete. Confirm the implementation before building automation that assumes end-to-end job status updates.

### Media

Recovered media must pass the offline scanner and be decoded/re-encoded before publication. Approved recovered files are mapped through `data/media-accepted.json` and served from `public/media/`.

New CMS uploads use Vercel Blob and are validated/transformed with Sharp.

Do not copy raw files from the compromised WordPress tree into `public/`. Reject executable, scriptable, mismatched, polyglot, traversal, symlink, and oversized inputs.

### Ads, Analytics, and SEO

- Google Analytics 4 is loaded on public routes and excluded from admin routes.
- Ezoic Gatekeeper/CMP must load before Google tracking so consent state is available first.
- Ezoic ad rendering and placement lifecycle are implemented under `components/ads/` and `lib/ads/`.
- Metadata uses the Next.js Metadata API with canonical, Open Graph, and Twitter values.
- Sitemap, robots, and RSS responses use generated root-level artifacts.

Consent and script order are behaviorally important. Preserve the sequence `Gatekeeper CMP -> TCF initialization -> Google tag` when changing layout, analytics, or ad scripts.

## Repository Map

- `app/`: App Router pages, layouts, route handlers, admin UI, and APIs.
- `components/`: shared public, article, CMS, analytics, and advertising components.
- `lib/`: content loading, validation, analytics, ads, authentication, CMS, and integrations.
- `content/`: generated validated content and CMS build export.
- `data/`: generated route, SEO, media, link, and redirect artifacts.
- `public/`: production static assets and approved media.
- `scripts/`: CMS export and media synchronization scripts.
- `tests/`: Vitest tests.
- `e2e/`: Playwright browser tests.
- `tools/wordpress-recovery/`: separate Node 20+ extraction, sanitization, media, URL, SEO, and content-generation utility.
- `.cursor/scratchpad.md`: ongoing Planner/Executor status, historical context, blockers, and lessons.

Historical design/recovery documents are useful context, but some predate the CMS, ads, and analytics implementation. Runtime code and tests are authoritative.

## Common Commands

Run these from the repository root:

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
npm start
```

Database and content commands:

```bash
npm run db:push
npm run db:generate
npm run db:studio
npm run cms:export
npm run media:sync
```

Install the Playwright browser when needed:

```bash
npx playwright install chromium
```

Important build behavior: `npm run build` runs `npm run cms:export` first and rewrites `content/cms-export.json`. If `DATABASE_URL` is absent, the export is empty. Inspect the resulting diff and do not accidentally commit a destructive empty export.

The recovery utility has its own `package.json`, lockfile, README, commands, and test suite. Run its commands from `tools/wordpress-recovery/`.

## Environment Variables

See `.env.example` for the maintained list. Major groups are:

- Database: `DATABASE_URL`.
- Admin: `CMS_ADMIN_EMAIL`, `CMS_ADMIN_PASSWORD` or `CMS_ADMIN_PASSWORD_HASH`.
- NextAuth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- Media: `BLOB_READ_WRITE_TOKEN`.
- Ads/analytics: Ezoic IDs and optional `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Deployment: `VERCEL_DEPLOY_HOOK_URL`.
- YouTube checks: optional `YOUTUBE_API_KEY`.
- Automation: `CRON_SECRET` and `AUTOPILOT_*`.
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_WEBHOOK_SECRET`.

Never commit `.env` files or real production values. Most CMS operations return an unavailable/error response when the database is not configured; public content should continue to work from files.

## Coding and Content Conventions

- Use the `@/*` TypeScript alias for repository-root imports.
- Preserve strict typing and validate external/file/database input with Zod or an equivalent explicit boundary.
- Prefer Server Components and static generation for public pages.
- Preserve URL paths, canonical URLs, and trailing-slash behavior.
- Sanitize HTML before storage and publication. Do not use `dangerouslySetInnerHTML` with unvalidated input.
- Keep public filtering and safe fallback behavior intact.
- Add or update focused Vitest tests for logic changes and Playwright tests for critical rendered flows.
- Keep error messages useful for debugging without exposing secrets or malicious payloads.
- Preserve unrelated working-tree changes; check `git status` and diffs before editing.

## Generated and Ignored Areas

Treat these as generated or externally sourced unless the task explicitly targets generation:

- `content/*.json`
- `data/*.json`
- Root SEO artifacts such as `sitemap.xml`, `robots.txt`, and `rss.xml`
- `public/media/`
- Recovery outputs and reports

Ignored local inputs/outputs include the quarantined backup, approved uploads, recovery intermediates, `.next`, coverage, and Playwright output. Do not assume ignored files exist in CI or Vercel.

`npm run media:sync` depends on ignored local recovery output. Generated public media and branding assets must be deliberately present in the deployment source or supplied by the deployment pipeline.

## Security Boundaries

1. Treat every recovered WordPress value and file as malicious until explicitly parsed, validated, and sanitized.
2. Never run WordPress, PHP, recovered SQL triggers, old themes/plugins, or quarantined scripts.
3. Only recovery tooling may read approved recovery inputs, and it should remain offline unless remote retrieval was explicitly authorized.
4. Do not weaken spam filtering, HTML sanitation, authentication, API scopes, webhook verification, or media validation to make a test pass.
5. Do not expose raw suspicious payloads in logs, admin errors, reports, or responses; use escaped, bounded previews.
6. Do not use forceful Git or dependency-fix commands without explicit approval.

## Known Operational Caveats

- `npm audit` reported 19 advisories (5 high, 14 moderate) on 2026-07-17. Some direct fixes are available, while the Next/PostCSS/toolchain recommendations include breaking or force changes. Re-run the audit before dependency work, but do not use `npm audit fix --force` without approval.
- There is no committed CI workflow or Docker setup; local scripts are the current validation contract.
- The main app has no explicit Node version pin.
- Drizzle schema exists, but migration files may not yet be committed; inspect before assuming migration-based deployment.
- `next/image` is configured with `unoptimized: true`.
- Public ad settings safely fall back when the database is unavailable.
- Ezoic fill usually cannot be validated on localhost.
- The Telegram webhook is less protected if `TELEGRAM_WEBHOOK_SECRET` is unset.
- Verify required branding and `public/media` assets before deployment; local ignored assets can hide missing-file problems.

## Agent Change Checklist

Before changing code:

1. Read `.cursor/scratchpad.md`, relevant source, tests, and current Git status.
2. Identify whether files are authored, generated, quarantined, or ignored.
3. Preserve existing unrelated changes.

Before handing off:

1. Run focused tests first.
2. Run `npm run typecheck` and `npm run lint` for substantive code changes.
3. Run `npm test`, and use `npm run build` or `npm run test:e2e` when the risk warrants it.
4. Inspect generated-file diffs, especially `content/cms-export.json`.
5. Record blockers, validation evidence, and pending confirmation in `.cursor/scratchpad.md`.
