import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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

export const topicSourceTypeEnum = pgEnum("topic_source_type", [
  "manual",
  "keyword",
  "url",
  "social",
  "video",
  "article",
]);

export const topicSourceFetchStatusEnum = pgEnum("topic_source_fetch_status", [
  "not_required",
  "pending",
  "processing",
  "completed",
  "limited",
  "failed",
]);

export const topicStatusEnum = pgEnum("topic_status", [
  "inbox",
  "processing",
  "needs_review",
  "approved",
  "scheduled",
  "drafting",
  "published",
  "rejected",
  "archived",
]);

export const topicPriorityEnum = pgEnum("topic_priority", ["low", "normal", "high", "urgent"]);

export const topicSearchIntentEnum = pgEnum("topic_search_intent", [
  "informational",
  "commercial",
  "transactional",
  "navigational",
  "discovery",
]);

export const topicSources = pgTable(
  "topic_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceType: topicSourceTypeEnum("source_type").notNull(),
    inputValue: text("input_value").notNull(),
    sourceUrl: text("source_url"),
    normalizedUrl: text("normalized_url"),
    platform: text("platform"),
    domain: text("domain"),
    originalText: text("original_text"),
    editorNotes: text("editor_notes"),
    pageTitle: text("page_title"),
    pageDescription: text("page_description"),
    authorName: text("author_name"),
    thumbnailUrl: text("thumbnail_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    extractedText: text("extracted_text"),
    rawMetadata: jsonb("raw_metadata").$type<Record<string, unknown> | null>(),
    fetchStatus: topicSourceFetchStatusEnum("fetch_status").notNull().default("not_required"),
    fetchErrorCode: text("fetch_error_code"),
    fetchErrorMessage: text("fetch_error_message"),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("topic_sources_created_at_idx").on(table.createdAt),
    index("topic_sources_fetch_status_idx").on(table.fetchStatus),
    index("topic_sources_normalized_url_idx").on(table.normalizedUrl),
    index("topic_sources_platform_idx").on(table.platform),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    primarySourceId: uuid("primary_source_id").references(() => topicSources.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    workingTitle: text("working_title"),
    summary: text("summary"),
    angle: text("angle"),
    readerProblem: text("reader_problem"),
    targetAudience: text("target_audience"),
    category: text("category"),
    primaryKeyword: text("primary_keyword"),
    secondaryKeywords: jsonb("secondary_keywords").$type<string[]>().notNull().default([]),
    searchIntent: topicSearchIntentEnum("search_intent"),
    relevanceScore: integer("relevance_score"),
    freshnessScore: integer("freshness_score"),
    evergreenScore: integer("evergreen_score"),
    confidenceScore: integer("confidence_score"),
    priority: topicPriorityEnum("priority").notNull().default("normal"),
    status: topicStatusEnum("status").notNull().default("inbox"),
    editorNotes: text("editor_notes"),
    rejectionReason: text("rejection_reason"),
    articleId: text("article_id").references(() => articles.id, { onDelete: "set null" }),
    calendarEntryId: uuid("calendar_entry_id").references(() => contentCalendar.id, {
      onDelete: "set null",
    }),
    mergedIntoTopicId: uuid("merged_into_topic_id"),
    createdBy: text("created_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("topics_status_idx").on(table.status),
    index("topics_priority_idx").on(table.priority),
    index("topics_primary_keyword_idx").on(table.primaryKeyword),
    index("topics_primary_source_id_idx").on(table.primarySourceId),
    index("topics_article_id_idx").on(table.articleId),
    index("topics_calendar_entry_id_idx").on(table.calendarEntryId),
    index("topics_created_at_idx").on(table.createdAt),
    index("topics_updated_at_idx").on(table.updatedAt),
  ],
);

export const topicSourceLinks = pgTable(
  "topic_source_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => topicSources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("topic_source_links_topic_source_uidx").on(table.topicId, table.sourceId),
    index("topic_source_links_topic_id_idx").on(table.topicId),
    index("topic_source_links_source_id_idx").on(table.sourceId),
  ],
);

export const topicActivity = pgTable(
  "topic_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    sourceId: uuid("source_id").references(() => topicSources.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    actorId: text("actor_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("topic_activity_topic_id_idx").on(table.topicId),
    index("topic_activity_source_id_idx").on(table.sourceId),
    index("topic_activity_created_at_idx").on(table.createdAt),
    index("topic_activity_event_type_idx").on(table.eventType),
  ],
);

export type ArticleRow = typeof articles.$inferSelect;
export type ArticleInsert = typeof articles.$inferInsert;
export type TopicSourceRow = typeof topicSources.$inferSelect;
export type TopicSourceInsert = typeof topicSources.$inferInsert;
export type TopicRow = typeof topics.$inferSelect;
export type TopicInsert = typeof topics.$inferInsert;
export type TopicSourceLinkRow = typeof topicSourceLinks.$inferSelect;
export type TopicActivityRow = typeof topicActivity.$inferSelect;
