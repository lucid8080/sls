import { and, asc, count, desc, eq, lt, ne, or } from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import { topicActivity, topicSourceLinks, topicSources, topics } from "@/lib/cms/db/schema";
import {
  detectSourcePlatform,
  isLimitedSocialPlatform,
} from "@/lib/integrations/source-extraction/detect-platform";
import { extractSourceMetadata } from "@/lib/integrations/source-extraction/extract-metadata";
import { fetchSafeUrl } from "@/lib/integrations/source-extraction/fetch-safe-url";
import { normalizeSourceUrl } from "@/lib/integrations/source-extraction/normalize-source-url";
import { parseSourceUrl } from "@/lib/integrations/source-extraction/validate-source-url";
import { sanitizeActivityMetadata } from "./activity-service";
import { TopicDomainError, isTopicDomainError } from "./errors";
import {
  fetchedMetadataSchema,
  type CreateManualTopicSourceInput,
  type CreateUrlTopicSourceInput,
  type UpdateTopicSourceInput,
} from "./schemas";

export function inferManualSourceType(input: string): "manual" | "keyword" {
  const value = input.trim();
  const looksLikeSentence = /[.!?]$/.test(value) || value.split(/\s+/).length > 8;
  return looksLikeSentence ? "manual" : "keyword";
}

export function determineSourceFetchStatus(
  platform: ReturnType<typeof detectSourcePlatform>,
): "completed" | "limited" {
  return isLimitedSocialPlatform(platform) ? "limited" : "completed";
}

export async function createManualSourceWithTopic(
  input: CreateManualTopicSourceInput,
  actorId: string,
) {
  const db = getDb();
  const sourceType = input.sourceType ?? inferManualSourceType(input.inputValue);

  // neon-http does not support interactive transactions — insert sequentially.
  const [source] = await db
    .insert(topicSources)
    .values({
      sourceType,
      inputValue: input.inputValue,
      originalText: input.inputValue,
      editorNotes: input.editorNotes,
      fetchStatus: "not_required",
      createdBy: actorId,
    })
    .returning();

  try {
    const [topic] = await db
      .insert(topics)
      .values({
        primarySourceId: source.id,
        title: input.inputValue,
        workingTitle: input.inputValue,
        category: input.category,
        priority: input.priority ?? "normal",
        status: "inbox",
        editorNotes: input.editorNotes,
        createdBy: actorId,
      })
      .returning();

    await db.insert(topicSourceLinks).values({ topicId: topic.id, sourceId: source.id });
    await db.insert(topicActivity).values([
      {
        sourceId: source.id,
        eventType: "source_created",
        actorId,
        metadata: sanitizeActivityMetadata({ sourceType }),
      },
      {
        topicId: topic.id,
        sourceId: source.id,
        eventType: "topic_created",
        actorId,
        metadata: sanitizeActivityMetadata({ status: topic.status, title: topic.title }),
      },
    ]);

    return { source, topic };
  } catch (error) {
    try {
      await db.delete(topicSources).where(eq(topicSources.id, source.id));
    } catch {
      // best-effort cleanup if a later insert fails
    }
    throw error;
  }
}

export async function createUrlSourceWithTopic(
  input: CreateUrlTopicSourceInput,
  actorId: string,
) {
  const url = parseSourceUrl(input.sourceUrl);
  const normalizedUrl = normalizeSourceUrl(url);
  const platform = detectSourcePlatform(url);
  const sourceType =
    input.sourceType ??
    (platform === "youtube"
      ? "video"
      : isLimitedSocialPlatform(platform)
        ? "social"
        : "url");
  const db = getDb();

  // neon-http does not support interactive transactions — insert sequentially.
  const [source] = await db
    .insert(topicSources)
    .values({
      sourceType,
      inputValue: input.inputValue,
      sourceUrl: url.toString(),
      normalizedUrl,
      platform,
      domain: url.hostname.toLowerCase(),
      editorNotes: input.editorNotes,
      fetchStatus: "pending",
      createdBy: actorId,
    })
    .returning();

  try {
    const [topic] = await db
      .insert(topics)
      .values({
        primarySourceId: source.id,
        title: input.inputValue,
        workingTitle: input.inputValue,
        category: input.category,
        priority: input.priority ?? "normal",
        status: "inbox",
        editorNotes: input.editorNotes,
        createdBy: actorId,
      })
      .returning();

    await db.insert(topicSourceLinks).values({ topicId: topic.id, sourceId: source.id });
    await db.insert(topicActivity).values([
      {
        sourceId: source.id,
        eventType: "source_created",
        actorId,
        metadata: sanitizeActivityMetadata({ sourceType, platform, domain: source.domain }),
      },
      {
        topicId: topic.id,
        sourceId: source.id,
        eventType: "topic_created",
        actorId,
        metadata: sanitizeActivityMetadata({ status: topic.status, title: topic.title }),
      },
    ]);

    return { source, topic };
  } catch (error) {
    try {
      await db.delete(topicSources).where(eq(topicSources.id, source.id));
    } catch {
      // best-effort cleanup if a later insert fails
    }
    throw error;
  }
}

export async function processTopicSource(
  sourceId: string,
  actorId: string,
  options?: { force?: boolean },
) {
  const db = getDb();
  const [source] = await db
    .select()
    .from(topicSources)
    .where(eq(topicSources.id, sourceId))
    .limit(1);

  if (!source) {
    throw new TopicDomainError("NOT_FOUND", "Topic Source not found.");
  }
  if (!source.sourceUrl) {
    throw new TopicDomainError(
      "VALIDATION_ERROR",
      "This Topic Source does not contain a URL.",
    );
  }
  if (source.fetchStatus === "completed" && !options?.force) {
    return source;
  }

  const staleProcessingBefore = new Date(Date.now() - 2 * 60 * 1000);
  const [claimed] = await db
    .update(topicSources)
    .set({
      fetchStatus: "processing",
      fetchErrorCode: null,
      fetchErrorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(topicSources.id, sourceId),
        or(
          ne(topicSources.fetchStatus, "processing"),
          lt(topicSources.updatedAt, staleProcessingBefore),
        ),
      ),
    )
    .returning();

  if (!claimed) {
    throw new TopicDomainError(
      "VALIDATION_ERROR",
      "This Topic Source is already being processed.",
    );
  }

  await db.insert(topicActivity).values({
    sourceId,
    eventType: "source_fetch_started",
    actorId,
    metadata: sanitizeActivityMetadata({ attempt: options?.force ? "retry" : "initial" }),
  });

  try {
    const fetched = await fetchSafeUrl(source.sourceUrl);
    const configuredMaxExtracted = Number(
      process.env.TOPIC_SOURCE_MAX_EXTRACTED_CHARS,
    );
    const maxExtractedChars = Number.isFinite(configuredMaxExtracted)
      ? Math.min(Math.max(configuredMaxExtracted, 1_000), 50_000)
      : 50_000;
    const extracted = extractSourceMetadata(fetched, {
      maxExtractedChars,
    });
    const validated = fetchedMetadataSchema.parse({
      finalUrl: extracted.finalUrl,
      pageTitle: extracted.pageTitle,
      pageDescription: extracted.pageDescription,
      authorName: extracted.authorName,
      thumbnailUrl: extracted.thumbnailUrl,
      publishedAt: extracted.publishedAt,
      extractedText: extracted.extractedText,
      platform: source.platform,
      domain: new URL(extracted.finalUrl).hostname.toLowerCase(),
      rawMetadata: {
        ...extracted.rawMetadata,
        ...(extracted.canonicalUrl ? { canonicalUrl: extracted.canonicalUrl } : {}),
      },
    });
    const platform = detectSourcePlatform(extracted.finalUrl);
    const fetchStatus = determineSourceFetchStatus(platform);
    const limited = fetchStatus === "limited";
    const now = new Date();

    const [updated] = await db
      .update(topicSources)
      .set({
        normalizedUrl: normalizeSourceUrl(extracted.finalUrl),
        platform,
        domain: validated.domain,
        pageTitle: validated.pageTitle,
        pageDescription: validated.pageDescription,
        authorName: validated.authorName,
        thumbnailUrl: validated.thumbnailUrl,
        publishedAt: validated.publishedAt ? new Date(validated.publishedAt) : null,
        extractedText: validated.extractedText,
        rawMetadata: validated.rawMetadata,
        fetchStatus,
        lastFetchedAt: now,
        updatedAt: now,
      })
      .where(eq(topicSources.id, sourceId))
      .returning();

    if (validated.pageTitle) {
      await db
        .update(topics)
        .set({ title: validated.pageTitle, workingTitle: validated.pageTitle, updatedAt: now })
        .where(
          and(
            eq(topics.primarySourceId, sourceId),
            eq(topics.title, source.inputValue),
          ),
        );
    }

    await db.insert(topicActivity).values({
      sourceId,
      eventType: limited ? "source_fetch_limited" : "source_fetch_completed",
      actorId,
      metadata: sanitizeActivityMetadata({
        contentType: fetched.contentType,
        redirectCount: fetched.redirectCount,
        hasTitle: Boolean(validated.pageTitle),
        extractedCharacters: validated.extractedText?.length ?? 0,
      }),
    });

    return updated;
  } catch (error) {
    const normalized = isTopicDomainError(error)
      ? error
      : new TopicDomainError(
          "SOURCE_FETCH_FAILED",
          "The public source could not be processed.",
          { cause: error },
        );
    const now = new Date();
    await db
      .update(topicSources)
      .set({
        fetchStatus: "failed",
        fetchErrorCode: normalized.code,
        fetchErrorMessage: normalized.message.slice(0, 500),
        lastFetchedAt: now,
        updatedAt: now,
      })
      .where(eq(topicSources.id, sourceId));
    await db.insert(topicActivity).values({
      sourceId,
      eventType: "source_fetch_failed",
      actorId,
      metadata: sanitizeActivityMetadata({ code: normalized.code }),
    });
    throw normalized;
  }
}

export async function updateTopicSourceDetails(
  sourceId: string,
  input: UpdateTopicSourceInput,
  actorId: string,
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(topicSources)
    .where(eq(topicSources.id, sourceId))
    .limit(1);
  if (!existing) {
    throw new TopicDomainError("NOT_FOUND", "Topic Source not found.");
  }

  const patch: Partial<typeof topicSources.$inferInsert> = {
    editorNotes:
      input.editorNotes === undefined ? existing.editorNotes : input.editorNotes,
    originalText:
      input.originalText === undefined ? existing.originalText : input.originalText,
    pageTitle: input.pageTitle === undefined ? existing.pageTitle : input.pageTitle,
    pageDescription:
      input.pageDescription === undefined
        ? existing.pageDescription
        : input.pageDescription,
    authorName:
      input.authorName === undefined ? existing.authorName : input.authorName,
    updatedAt: new Date(),
  };

  if (input.sourceUrl !== undefined && input.sourceUrl !== null) {
    const url = parseSourceUrl(input.sourceUrl);
    patch.sourceUrl = url.toString();
    patch.normalizedUrl = normalizeSourceUrl(url);
    patch.platform = detectSourcePlatform(url);
    patch.domain = url.hostname.toLowerCase();
    patch.fetchStatus = "pending";
    patch.fetchErrorCode = null;
    patch.fetchErrorMessage = null;
  }

  const [updated] = await db
    .update(topicSources)
    .set(patch)
    .where(eq(topicSources.id, sourceId))
    .returning();
  await db.insert(topicActivity).values({
    sourceId,
    eventType: "source_updated",
    actorId,
    metadata: sanitizeActivityMetadata({ fields: Object.keys(input) }),
  });
  return updated;
}

export async function listTopicSources(options?: {
  page?: number;
  pageSize?: number;
  fetchStatus?: (typeof topicSources.$inferSelect)["fetchStatus"];
}) {
  const db = getDb();
  const page = Math.max(options?.page ?? 1, 1);
  const pageSize = Math.min(Math.max(options?.pageSize ?? 25, 1), 100);
  const where = options?.fetchStatus
    ? eq(topicSources.fetchStatus, options.fetchStatus)
    : undefined;
  const orderBy = options?.fetchStatus
    ? asc(topicSources.createdAt)
    : desc(topicSources.createdAt);
  const [totalRow] = await db
    .select({ value: count() })
    .from(topicSources)
    .where(where);
  const items = await db
    .select()
    .from(topicSources)
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total: Number(totalRow?.value ?? 0), page, pageSize };
}
