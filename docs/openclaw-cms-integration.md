# OpenClaw CMS Integration

This guide replaces the old WordPress REST workflow with the Simple Life Saver Agent API.

## Base URL

```text
https://simplelifesaver.com/api/agent/v1
```

Local development:

```text
http://localhost:3000/api/agent/v1
```

## Authentication

Create an API key in `/admin/agents`, then send:

```http
Authorization: Bearer sls_<your-key>
```

Scopes:

- `agent:read` — read articles, jobs, internal search
- `agent:write` — create/update drafts, upload media
- `agent:publish` — publish approved articles
- `agent:calendar` — read content calendar slots

## Daily autopilot workflow

1. Cron creates a pending job at 8:00 AM America/New_York (configurable).
2. OpenClaw polls `GET /jobs/pending` or reads `GET /calendar/today`.
3. OpenClaw researches and writes the article.
4. OpenClaw calls `POST /articles` with HTML body and metadata.
5. OpenClaw calls `POST /articles/{id}/submit-review`.
6. You approve via admin UI or Telegram, then publish with `POST /articles/{id}/publish`.

## Endpoints

### Create draft

```http
POST /articles
Content-Type: application/json
Authorization: Bearer sls_...

{
  "title": "Best Robot Vacuums for Pet Hair in 2026",
  "html": "<p>...</p>",
  "excerpt": "Short summary",
  "status": "draft",
  "categories": [{ "id": "156", "name": "Smart Cooking", "slug": "smart-cooking" }],
  "seo": {
    "description": "SEO description",
    "noindex": true
  }
}
```

### Update draft

```http
PATCH /articles/{id}
```

### Submit for review

```http
POST /articles/{id}/submit-review
```

### Publish

```http
POST /articles/{id}/publish
```

Publishing runs sanitization, Zod validation, quality gates, exports `content/cms-export.json`, and triggers the Vercel deploy hook when configured.

### Today's calendar slot

```http
GET /calendar/today
```

### Internal link discovery

```http
GET /search/internal?q=instant+pot
```

### Upload featured image

```http
POST /media
Content-Type: multipart/form-data

file=<image>
alt=Descriptive alt text
```

### Poll jobs

```http
GET /jobs/pending
GET /jobs/{id}
```

## Telegram (optional)

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and point your bot webhook to:

```text
POST /api/telegram/webhook
```

Commands:

- `publish <articleId>` — reminder to call publish API
- `revise <articleId> <notes>` — request revision via PATCH
- `help`

## Quality gates

Publish fails (stays in review) when:

- HTML contains executable patterns
- Article is too short
- Casino/gambling spam patterns are detected
- Schema validation fails

Warnings (non-blocking by default):

- Missing FAQ section
- Low internal link count
- Unresolved internal links

## Migration from WordPress REST

| WordPress | CMS Agent API |
|-----------|---------------|
| `POST /wp-json/wp/v2/posts` | `POST /api/agent/v1/articles` |
| `POST /wp-json/wp/v2/posts/{id}` | `PATCH /api/agent/v1/articles/{id}` |
| `POST /wp-json/wp/v2/media` | `POST /api/agent/v1/media` |
| Manual publish in wp-admin | `POST /api/agent/v1/articles/{id}/publish` |

## Setup checklist

1. Set `DATABASE_URL` on Vercel.
2. Run `npm run db:push` against Neon.
3. Set admin credentials and `NEXTAUTH_SECRET`.
4. Create an agent API key in `/admin/agents`.
5. Add calendar entries in `/admin/calendar`.
6. Configure `VERCEL_DEPLOY_HOOK_URL` for automatic redeploys after publish.
7. Enable autopilot in `/admin/settings` when ready.
