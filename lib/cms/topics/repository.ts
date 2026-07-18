import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import {
  topicSourceLinks,
  topicSources,
  topics,
  type TopicInsert,
  type TopicRow,
  type TopicSourceInsert,
  type TopicSourceLinkRow,
  type TopicSourceRow,
} from "@/lib/cms/db/schema";
import { TOPIC_STATUSES } from "./constants";
import { TopicDomainError } from "./errors";
import type { CreateTopicInput, TopicListFilters, UpdateTopicInput } from "./schemas";
import { assertTopicTransition, transitionEventForStatus } from "./transition-service";
import { recordTopicActivity } from "./activity-service";
import type { TopicActivityEvent, TopicStatus, TopicStatusCounts, TopicWithSources } from "./types";

function emptyStatusCounts(): TopicStatusCounts {
  return TOPIC_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as TopicStatusCounts);
}

export async function insertTopicSource(
  values: TopicSourceInsert,
): Promise<TopicSourceRow> {
  const db = getDb();
  const [row] = await db.insert(topicSources).values(values).returning();
  return row;
}

export async function getTopicSourceById(id: string): Promise<TopicSourceRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(topicSources).where(eq(topicSources.id, id)).limit(1);
  return row;
}

export async function updateTopicSourceById(
  id: string,
  values: Partial<TopicSourceInsert>,
): Promise<TopicSourceRow | undefined> {
  const db = getDb();
  const [row] = await db
    .update(topicSources)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(topicSources.id, id))
    .returning();
  return row;
}

export async function linkTopicSource(
  topicId: string,
  sourceId: string,
): Promise<TopicSourceLinkRow> {
  const db = getDb();
  const existing = await db
    .select()
    .from(topicSourceLinks)
    .where(and(eq(topicSourceLinks.topicId, topicId), eq(topicSourceLinks.sourceId, sourceId)))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [row] = await db
    .insert(topicSourceLinks)
    .values({ topicId, sourceId })
    .returning();
  return row;
}

export async function listSourcesForTopic(topicId: string): Promise<TopicSourceRow[]> {
  const db = getDb();
  const rows = await db
    .select({ source: topicSources })
    .from(topicSourceLinks)
    .innerJoin(topicSources, eq(topicSourceLinks.sourceId, topicSources.id))
    .where(eq(topicSourceLinks.topicId, topicId));
  return rows.map((row) => row.source);
}

export async function insertTopic(
  values: TopicInsert,
  options?: { sourceIds?: string[]; actorId?: string | null },
): Promise<TopicRow> {
  const db = getDb();
  const [row] = await db.insert(topics).values(values).returning();

  const sourceIds = new Set<string>(options?.sourceIds ?? []);
  if (values.primarySourceId) {
    sourceIds.add(values.primarySourceId);
  }

  for (const sourceId of sourceIds) {
    await linkTopicSource(row.id, sourceId);
  }

  await recordTopicActivity({
    topicId: row.id,
    sourceId: values.primarySourceId ?? null,
    eventType: "topic_created",
    actorId: options?.actorId ?? values.createdBy ?? null,
    metadata: { status: row.status, title: row.title },
  });

  return row;
}

export async function createTopicFromInput(
  input: CreateTopicInput,
  actorId?: string | null,
): Promise<TopicRow> {
  return insertTopic(
    {
      title: input.title,
      workingTitle: input.workingTitle,
      summary: input.summary,
      angle: input.angle,
      readerProblem: input.readerProblem,
      targetAudience: input.targetAudience,
      category: input.category,
      primaryKeyword: input.primaryKeyword,
      secondaryKeywords: input.secondaryKeywords ?? [],
      searchIntent: input.searchIntent,
      relevanceScore: input.relevanceScore,
      freshnessScore: input.freshnessScore,
      evergreenScore: input.evergreenScore,
      confidenceScore: input.confidenceScore,
      priority: input.priority ?? "normal",
      status: input.status ?? "inbox",
      editorNotes: input.editorNotes,
      primarySourceId: input.primarySourceId,
      createdBy: actorId ?? null,
    },
    { sourceIds: input.sourceIds, actorId },
  );
}

export async function getTopicById(id: string): Promise<TopicRow | undefined> {
  const db = getDb();
  const [row] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  return row;
}

export async function getTopicWithSources(id: string): Promise<TopicWithSources | undefined> {
  const topic = await getTopicById(id);
  if (!topic) {
    return undefined;
  }

  const db = getDb();
  const links = await db
    .select()
    .from(topicSourceLinks)
    .where(eq(topicSourceLinks.topicId, id));
  const sources = await listSourcesForTopic(id);
  const primarySource = topic.primarySourceId
    ? ((await getTopicSourceById(topic.primarySourceId)) ?? null)
    : null;

  return {
    ...topic,
    primarySource,
    sources,
    links,
  };
}

export async function updateTopicById(
  id: string,
  input: UpdateTopicInput,
  actorId?: string | null,
): Promise<TopicRow> {
  const existing = await getTopicById(id);
  if (!existing) {
    throw new TopicDomainError("NOT_FOUND", "Topic not found.");
  }

  const db = getDb();
  const [row] = await db
    .update(topics)
    .set({
      title: input.title ?? existing.title,
      workingTitle:
        input.workingTitle === undefined ? existing.workingTitle : input.workingTitle,
      summary: input.summary === undefined ? existing.summary : input.summary,
      angle: input.angle === undefined ? existing.angle : input.angle,
      readerProblem:
        input.readerProblem === undefined ? existing.readerProblem : input.readerProblem,
      targetAudience:
        input.targetAudience === undefined ? existing.targetAudience : input.targetAudience,
      category: input.category === undefined ? existing.category : input.category,
      primaryKeyword:
        input.primaryKeyword === undefined ? existing.primaryKeyword : input.primaryKeyword,
      secondaryKeywords: input.secondaryKeywords ?? existing.secondaryKeywords,
      searchIntent:
        input.searchIntent === undefined ? existing.searchIntent : input.searchIntent,
      relevanceScore:
        input.relevanceScore === undefined ? existing.relevanceScore : input.relevanceScore,
      freshnessScore:
        input.freshnessScore === undefined ? existing.freshnessScore : input.freshnessScore,
      evergreenScore:
        input.evergreenScore === undefined ? existing.evergreenScore : input.evergreenScore,
      confidenceScore:
        input.confidenceScore === undefined ? existing.confidenceScore : input.confidenceScore,
      priority: input.priority ?? existing.priority,
      editorNotes: input.editorNotes === undefined ? existing.editorNotes : input.editorNotes,
      rejectionReason:
        input.rejectionReason === undefined ? existing.rejectionReason : input.rejectionReason,
      updatedAt: new Date(),
    })
    .where(eq(topics.id, id))
    .returning();

  await recordTopicActivity({
    topicId: row.id,
    sourceId: row.primarySourceId,
    eventType: "topic_updated",
    actorId: actorId ?? null,
    metadata: { fields: Object.keys(input) },
  });

  return row;
}

export async function transitionTopicStatus(
  id: string,
  toStatus: TopicStatus,
  options?: {
    actorId?: string | null;
    rejectionReason?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<TopicRow> {
  const existing = await getTopicById(id);
  if (!existing) {
    throw new TopicDomainError("NOT_FOUND", "Topic not found.");
  }

  assertTopicTransition(existing.status, toStatus);

  const now = new Date();
  const patch: Partial<TopicInsert> = {
    status: toStatus,
    updatedAt: now,
  };

  if (toStatus === "approved") {
    patch.approvedAt = now;
  }
  if (toStatus === "scheduled") {
    patch.scheduledAt = now;
  }
  if (toStatus === "published") {
    patch.publishedAt = now;
  }
  if (toStatus === "rejected" && options?.rejectionReason) {
    patch.rejectionReason = options.rejectionReason;
  }
  if (toStatus === "inbox") {
    patch.rejectionReason = null;
  }

  const db = getDb();
  const [row] = await db.update(topics).set(patch).where(eq(topics.id, id)).returning();

  const eventType = transitionEventForStatus(toStatus) as TopicActivityEvent;
  await recordTopicActivity({
    topicId: row.id,
    sourceId: row.primarySourceId,
    eventType,
    actorId: options?.actorId ?? null,
    metadata: {
      from: existing.status,
      to: toStatus,
      ...(options?.metadata ?? {}),
    },
  });

  return row;
}

export async function deleteTopicById(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db.delete(topics).where(eq(topics.id, id)).returning({ id: topics.id });
  return deleted.length > 0;
}

function buildTopicFilterClauses(filters: TopicListFilters): SQL[] {
  const clauses: SQL[] = [];

  if (filters.status) {
    clauses.push(eq(topics.status, filters.status));
  }
  if (filters.statuses?.length) {
    clauses.push(inArray(topics.status, filters.statuses));
  }
  if (filters.priority) {
    clauses.push(eq(topics.priority, filters.priority));
  }
  if (filters.category) {
    clauses.push(eq(topics.category, filters.category));
  }
  if (filters.platform) {
    clauses.push(eq(topicSources.platform, filters.platform));
  }
  if (filters.createdFrom) {
    clauses.push(gte(topics.createdAt, new Date(filters.createdFrom)));
  }
  if (filters.createdTo) {
    clauses.push(lte(topics.createdAt, new Date(filters.createdTo)));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    clauses.push(
      or(
        ilike(topics.title, pattern),
        ilike(topics.workingTitle, pattern),
        ilike(topics.primaryKeyword, pattern),
        ilike(topics.summary, pattern),
      )!,
    );
  }

  return clauses;
}

export async function listTopics(filters: TopicListFilters): Promise<{
  items: Array<TopicRow & { primarySource: TopicSourceRow | null }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = getDb();
  const clauses = buildTopicFilterClauses(filters);
  const where = clauses.length ? and(...clauses) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const orderColumn =
    filters.sort === "created_at"
      ? topics.createdAt
      : filters.sort === "priority"
        ? topics.priority
        : filters.sort === "status"
          ? topics.status
          : filters.sort === "title"
            ? topics.title
            : topics.updatedAt;

  const orderBy = filters.direction === "asc" ? asc(orderColumn) : desc(orderColumn);

  const [totalRow] = await db
    .select({ value: count() })
    .from(topics)
    .leftJoin(topicSources, eq(topics.primarySourceId, topicSources.id))
    .where(where);
  const items = await db
    .select({ topic: topics, primarySource: topicSources })
    .from(topics)
    .leftJoin(topicSources, eq(topics.primarySourceId, topicSources.id))
    .where(where)
    .orderBy(orderBy)
    .limit(filters.pageSize)
    .offset(offset);

  return {
    items: items.map(({ topic, primarySource }) => ({ ...topic, primarySource })),
    total: Number(totalRow?.value ?? 0),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function countTopicsByStatus(): Promise<TopicStatusCounts> {
  const db = getDb();
  const rows = await db
    .select({ status: topics.status, value: count() })
    .from(topics)
    .groupBy(topics.status);

  const counts = emptyStatusCounts();
  for (const row of rows) {
    counts[row.status] = Number(row.value);
  }
  return counts;
}

/** Lightweight existence check used by later duplicate / merge flows. */
export async function findTopicsByNormalizedTitle(
  normalizedTitle: string,
  limit = 10,
): Promise<TopicRow[]> {
  const db = getDb();
  return db
    .select()
    .from(topics)
    .where(sql`lower(regexp_replace(${topics.title}, '[^a-z0-9]+', ' ', 'g')) = ${normalizedTitle}`)
    .limit(limit);
}
