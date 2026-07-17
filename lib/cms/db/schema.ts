import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "in_review",
  "scheduled",
  "published",
  "archived",
]);

export const agentJobTypeEnum = pgEnum("agent_job_type", ["generate", "update", "publish"]);
export const agentJobStatusEnum = pgEnum("agent_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const articles = pgTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  pathname: text("pathname").notNull(),
  status: articleStatusEnum("status").notNull().default("draft"),
  excerpt: text("excerpt"),
  html: text("html").notNull().default(""),
  author: jsonb("author").$type<{ id: string; name: string; slug: string } | null>(),
  categories: jsonb("categories")
    .$type<Array<{ id: string; name: string; slug: string }>>()
    .notNull()
    .default([]),
  tags: jsonb("tags")
    .$type<Array<{ id: string; name: string; slug: string }>>()
    .notNull()
    .default([]),
  featuredImage: jsonb("featured_image").$type<Record<string, unknown> | null>(),
  seo: jsonb("seo")
    .$type<{
      title?: string;
      description?: string;
      canonicalPath: string;
      ogImage?: string;
      noindex: boolean;
    }>()
    .notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  modifiedAt: timestamp("modified_at", { withTimezone: true }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articleRevisions = pgTable("article_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: text("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentCalendar = pgTable("content_calendar", {
  id: uuid("id").primaryKey().defaultRandom(),
  calendarDate: text("calendar_date").notNull().unique(),
  topic: text("topic").notNull(),
  contentType: text("content_type").notNull().default("new"),
  categorySlug: text("category_slug"),
  internalLinkTargets: jsonb("internal_link_targets").$type<string[]>().default([]),
  seoChecklist: jsonb("seo_checklist")
    .$type<{
      requireFaq?: boolean;
      minInternalLinks?: number;
      minWordCount?: number;
    }>()
    .default({}),
  notes: text("notes"),
  articleId: text("article_id").references(() => articles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentJobs = pgTable("agent_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: agentJobTypeEnum("type").notNull(),
  status: agentJobStatusEnum("status").notNull().default("pending"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  result: jsonb("result").$type<Record<string, unknown> | null>(),
  error: text("error"),
  articleId: text("article_id").references(() => articles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const publishLog = pgTable("publish_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: text("article_id").references(() => articles.id, { onDelete: "set null" }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  validationReport: jsonb("validation_report").$type<Record<string, unknown> | null>(),
  deployId: text("deploy_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cmsSettings = pgTable("cms_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  publicPath: text("public_path").notNull(),
  blobUrl: text("blob_url"),
  alt: text("alt"),
  width: text("width"),
  height: text("height"),
  mimeType: text("mime_type").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ArticleRow = typeof articles.$inferSelect;
export type ArticleInsert = typeof articles.$inferInsert;
