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
- `agent:write` — create/update article drafts
- `agent:publish` — publish approved articles
- `agent:calendar` — read content calendar slots
- `agent:ads` — read/update ad placement settings
- `agent:affiliates` — manage affiliate links
- `agent:media` — list, upload, edit, and delete media
- `agent:topics` — manage the topic inbox

Scopes are selected per key in `/admin/agents` and can be edited (or the key deleted) at any time.
Media upload requires `agent:media`; keys created before this scope existed must have it added.

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

### Media library (`agent:media`)

```http
GET /media?search=vacuum&source=database&limit=50&offset=0
GET /media/{id}
PATCH /media/{id}          # { "alt": "Descriptive alt text" }
DELETE /media/{id}         # 409 when the asset is still referenced
```

Upload a new asset:

```http
POST /media
Content-Type: multipart/form-data

file=<image>
alt=Descriptive alt text
```

### Ads (`agent:ads`)

```http
GET /ads
POST /ads                  # { "globalEnabled": true, "placements": { "<key>": { "enabled": false } } }
```

### Affiliate links (`agent:affiliates`)

```http
GET /affiliates?network=amazon&tagStatus=missing_tag&search=blender
POST /affiliates           # { "url": "https://...", "label": "...", "notes": "..." }
GET /affiliates/{id}
PATCH /affiliates/{id}
DELETE /affiliates/{id}
```

### Topic inbox (`agent:topics`)

```http
GET /topics?status=new&page=1&pageSize=25
POST /topics
GET /topics/{id}
PATCH /topics/{id}
DELETE /topics/{id}
POST /topics/{id}/transition   # { "toStatus": "approved" }
```

Rejecting a topic requires `rejectionReason`. Topics linked to an article or calendar entry
cannot be deleted — archive them instead.

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
- Casino/gambling spam patterns are detected
- Schema validation fails
- Article is missing an H2 heading

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
