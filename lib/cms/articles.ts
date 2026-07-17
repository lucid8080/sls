import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import {
  agentJobs,
  articleRevisions,
  articles,
  contentCalendar,
  type ArticleInsert,
  type ArticleRow,
} from "@/lib/cms/db/schema";
import { pathnameFromSlug, slugifyTitle, type ArticleStatus } from "@/lib/cms/schemas";

export function createArticleId(): string {
  return `cms_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function listArticles(filters?: {
  status?: ArticleStatus;
  search?: string;
  limit?: number;
}): Promise<ArticleRow[]> {
  const db = getDb();
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(articles.status, filters.status));
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(articles.title, term), ilike(articles.slug, term)));
  }

  const query = db
    .select()
    .from(articles)
    .orderBy(desc(articles.updatedAt))
    .limit(filters?.limit ?? 100);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export async function getArticleById(id: string): Promise<ArticleRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return row;
}

export async function getArticleBySlug(slug: string): Promise<ArticleRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return row;
}

export type ArticleInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  html: string;
  status?: ArticleStatus;
  author?: ArticleInsert["author"];
  categories?: ArticleInsert["categories"];
  tags?: ArticleInsert["tags"];
  featuredImage?: ArticleInsert["featuredImage"];
  seo?: ArticleInsert["seo"];
  scheduledAt?: Date | null;
  createdBy?: string;
};

export async function createArticle(input: ArticleInput): Promise<ArticleRow> {
  const db = getDb();
  const slug = input.slug ?? slugifyTitle(input.title);
  const pathname = pathnameFromSlug(slug);
  const now = new Date();
  const id = createArticleId();

  const seo = input.seo ?? {
    canonicalPath: pathname,
    noindex: input.status !== "published",
  };

  const [row] = await db
    .insert(articles)
    .values({
      id,
      title: input.title,
      slug,
      pathname,
      status: input.status ?? "draft",
      excerpt: input.excerpt,
      html: input.html,
      author: input.author ?? null,
      categories: input.categories ?? [],
      tags: input.tags ?? [],
      featuredImage: input.featuredImage ?? null,
      seo,
      scheduledAt: input.scheduledAt ?? null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      modifiedAt: now,
    })
    .returning();

  await saveRevision(row, input.createdBy);
  return row;
}

export async function updateArticle(
  id: string,
  input: Partial<ArticleInput>,
  actor?: string,
): Promise<ArticleRow | undefined> {
  const db = getDb();
  const existing = await getArticleById(id);
  if (!existing) {
    return undefined;
  }

  const slug = input.slug ?? existing.slug;
  const pathname = pathnameFromSlug(slug);
  const now = new Date();

  const [row] = await db
    .update(articles)
    .set({
      title: input.title ?? existing.title,
      slug,
      pathname,
      excerpt: input.excerpt ?? existing.excerpt,
      html: input.html ?? existing.html,
      status: input.status ?? existing.status,
      author: input.author === undefined ? existing.author : input.author,
      categories: input.categories ?? existing.categories,
      tags: input.tags ?? existing.tags,
      featuredImage: input.featuredImage === undefined ? existing.featuredImage : input.featuredImage,
      seo: input.seo ?? existing.seo,
      scheduledAt: input.scheduledAt === undefined ? existing.scheduledAt : input.scheduledAt,
      updatedAt: now,
      modifiedAt: now,
    })
    .where(eq(articles.id, id))
    .returning();

  await saveRevision(row, actor);
  return row;
}

export async function setArticleStatus(
  id: string,
  status: ArticleStatus,
  actor?: string,
): Promise<ArticleRow | undefined> {
  return updateArticle(id, { status }, actor);
}

export async function saveRevision(row: ArticleRow, actor?: string): Promise<void> {
  const db = getDb();
  await db.insert(articleRevisions).values({
    articleId: row.id,
    snapshot: row,
    createdBy: actor,
  });
}

export async function listRevisions(articleId: string) {
  const db = getDb();
  return db
    .select()
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId))
    .orderBy(desc(articleRevisions.createdAt))
    .limit(20);
}

export async function searchInternalArticles(query: string, limit = 20) {
  const db = getDb();
  const term = `%${query}%`;
  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      pathname: articles.pathname,
      status: articles.status,
    })
    .from(articles)
    .where(and(or(ilike(articles.title, term), ilike(articles.slug, term)), eq(articles.status, "published")))
    .limit(limit);
}

export async function listCalendarEntries(from?: string, to?: string) {
  const db = getDb();
  const conditions = [];
  if (from) {
    conditions.push(sql`${contentCalendar.calendarDate} >= ${from}`);
  }
  if (to) {
    conditions.push(sql`${contentCalendar.calendarDate} <= ${to}`);
  }

  const query = db.select().from(contentCalendar).orderBy(contentCalendar.calendarDate);
  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function getCalendarEntryByDate(date: string) {
  const db = getDb();
  const [row] = await db.select().from(contentCalendar).where(eq(contentCalendar.calendarDate, date)).limit(1);
  return row;
}

export async function upsertCalendarEntry(input: {
  calendarDate: string;
  topic: string;
  contentType?: string;
  categorySlug?: string;
  internalLinkTargets?: string[];
  seoChecklist?: Record<string, unknown>;
  notes?: string;
}) {
  const db = getDb();
  const existing = await getCalendarEntryByDate(input.calendarDate);
  if (existing) {
    const [row] = await db
      .update(contentCalendar)
      .set({
        topic: input.topic,
        contentType: input.contentType ?? existing.contentType,
        categorySlug: input.categorySlug ?? existing.categorySlug,
        internalLinkTargets: input.internalLinkTargets ?? existing.internalLinkTargets ?? [],
        seoChecklist: input.seoChecklist ?? existing.seoChecklist ?? {},
        notes: input.notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(contentCalendar.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(contentCalendar)
    .values({
      calendarDate: input.calendarDate,
      topic: input.topic,
      contentType: input.contentType ?? "new",
      categorySlug: input.categorySlug,
      internalLinkTargets: input.internalLinkTargets ?? [],
      seoChecklist: input.seoChecklist ?? {},
      notes: input.notes,
    })
    .returning();
  return row;
}

export async function createAgentJob(input: {
  type: "generate" | "update" | "publish";
  payload?: Record<string, unknown>;
  articleId?: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(agentJobs)
    .values({
      type: input.type,
      payload: input.payload ?? {},
      articleId: input.articleId,
      status: "pending",
    })
    .returning();
  return row;
}

export async function getAgentJob(id: string) {
  const db = getDb();
  const [row] = await db.select().from(agentJobs).where(eq(agentJobs.id, id)).limit(1);
  return row;
}

export async function listPendingAgentJobs(limit = 10) {
  const db = getDb();
  return db
    .select()
    .from(agentJobs)
    .where(eq(agentJobs.status, "pending"))
    .orderBy(agentJobs.createdAt)
    .limit(limit);
}

export async function updateAgentJob(
  id: string,
  input: {
    status?: "pending" | "running" | "completed" | "failed";
    result?: Record<string, unknown> | null;
    error?: string | null;
    articleId?: string | null;
  },
) {
  const db = getDb();
  const [row] = await db
    .update(agentJobs)
    .set({
      status: input.status,
      result: input.result,
      error: input.error,
      articleId: input.articleId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(agentJobs.id, id))
    .returning();
  return row;
}

export async function listPublishedArticles(): Promise<ArticleRow[]> {
  const db = getDb();
  return db.select().from(articles).where(eq(articles.status, "published")).orderBy(desc(articles.publishedAt));
}
