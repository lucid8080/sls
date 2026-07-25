import { eq } from "drizzle-orm";
import type { ContentItem } from "@/lib/content";
import { getRecoveredContentBundle } from "@/lib/content";
import { saveRevision } from "@/lib/cms/articles";
import { getDb } from "@/lib/cms/db/client";
import { articles, publishLog } from "@/lib/cms/db/schema";
import { revalidateCmsContent } from "@/lib/cms/revalidate-content";
import {
  checkYouTubeAvailability,
  extractYouTubeEmbeds,
  isRemovableStatus,
  removeYouTubeEmbeds,
  type YouTubeAvailability,
} from "@/lib/youtube-cleanup";

export type RecoveredYouTubeScanItem = {
  articleId: string;
  articleTitle: string;
  pathname: string;
  videoId: string;
  url: string;
  status: YouTubeAvailability["status"];
  error?: string;
};

export type RecoveredYouTubeScan = {
  checkedAt: string;
  method: "youtube-data-api" | "youtube-oembed";
  articleCount: number;
  embedCount: number;
  uniqueVideoCount: number;
  unavailableCount: number;
  restrictedCount: number;
  errorCount: number;
  items: RecoveredYouTubeScanItem[];
};

export async function scanRecoveredYouTubeEmbeds(): Promise<RecoveredYouTubeScan> {
  const articlesWithHtml = await getRecoveredArticlesWithCurrentHtml();
  const embeds = articlesWithHtml.flatMap(({ article, html }) =>
    extractYouTubeEmbeds(html).map((embed) => ({
      articleId: article.id,
      articleTitle: article.title,
      pathname: article.pathname,
      ...embed,
    })),
  );
  const uniqueIds = [...new Set(embeds.map((embed) => embed.videoId))];
  const availability = await checkYouTubeAvailability(uniqueIds, {
    apiKey: process.env.YOUTUBE_API_KEY,
  });
  const byId = new Map(availability.videos.map((video) => [video.videoId, video]));
  const items = embeds.map((embed): RecoveredYouTubeScanItem => {
    const result = byId.get(embed.videoId);
    return {
      ...embed,
      status: result?.status ?? "error",
      error: result?.error ?? (result ? undefined : "Video availability was not checked."),
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    method: availability.method,
    articleCount: new Set(items.map((item) => item.articleId)).size,
    embedCount: items.length,
    uniqueVideoCount: uniqueIds.length,
    unavailableCount: items.filter((item) => item.status === "unavailable").length,
    restrictedCount: items.filter((item) => item.status === "restricted").length,
    errorCount: items.filter((item) => item.status === "error").length,
    items,
  };
}

export async function removeRecoveredYouTubeEmbeds(
  requestedVideoIds: readonly string[],
  actor: string,
): Promise<{
  removedEmbedCount: number;
  updatedArticleCount: number;
  removedVideoIds: string[];
  skippedVideoIds: string[];
  skippedReasons: Record<string, string>;
  revalidated: boolean;
}> {
  const requested = [...new Set(requestedVideoIds)];
  const availability = await checkYouTubeAvailability(requested, {
    apiKey: process.env.YOUTUBE_API_KEY,
  });
  const byId = new Map(availability.videos.map((video) => [video.videoId, video]));
  const removable = new Set<string>();
  const skippedVideoIds: string[] = [];
  const skippedReasons: Record<string, string> = {};

  for (const videoId of requested) {
    const result = byId.get(videoId);
    // Protect working embeds: never remove videos that recheck as available.
    // Allow unavailable, restricted, and error (admin-selected).
    if (!result) {
      removable.add(videoId);
      continue;
    }
    if (result.status === "available") {
      skippedVideoIds.push(videoId);
      skippedReasons[videoId] = "Recheck found this video available.";
      continue;
    }
    if (!isRemovableStatus(result.status)) {
      skippedVideoIds.push(videoId);
      skippedReasons[videoId] = `Status ${result.status} cannot be removed.`;
      continue;
    }
    removable.add(videoId);
  }

  if (removable.size === 0) {
    return {
      removedEmbedCount: 0,
      updatedArticleCount: 0,
      removedVideoIds: [],
      skippedVideoIds,
      skippedReasons,
      revalidated: false,
    };
  }

  const articlesWithHtml = await getRecoveredArticlesWithCurrentHtml();
  let removedEmbedCount = 0;
  let updatedArticleCount = 0;

  for (const { article, html } of articlesWithHtml) {
    const cleaned = removeYouTubeEmbeds(html, removable);
    if (cleaned.removedCount === 0) {
      continue;
    }

    const removedFromArticle = extractYouTubeEmbeds(html)
      .map((embed) => embed.videoId)
      .filter((videoId) => removable.has(videoId));

    const row = await upsertRecoveredArticleOverride(article, cleaned.html, actor);
    await saveRevision(row, actor);
    await getDb().insert(publishLog).values({
      articleId: row.id,
      actor,
      action: "removed_youtube_embeds",
      validationReport: {
        removedCount: cleaned.removedCount,
        videoIds: removedFromArticle,
        statuses: Object.fromEntries(
          removedFromArticle.map((videoId) => [videoId, byId.get(videoId)?.status ?? "unknown"]),
        ),
      },
    });

    removedEmbedCount += cleaned.removedCount;
    updatedArticleCount += 1;
  }

  if (updatedArticleCount > 0) {
    revalidateCmsContent();
  }

  return {
    removedEmbedCount,
    updatedArticleCount,
    removedVideoIds: [...removable],
    skippedVideoIds,
    skippedReasons,
    revalidated: updatedArticleCount > 0,
  };
}

/** @deprecated Prefer removeRecoveredYouTubeEmbeds */
export const removeUnavailableRecoveredYouTubeEmbeds = removeRecoveredYouTubeEmbeds;

async function getRecoveredArticlesWithCurrentHtml(): Promise<
  Array<{ article: ContentItem; html: string }>
> {
  const recoveredArticles = getRecoveredContentBundle().articles;
  const currentRows = await getDb()
    .select({ id: articles.id, html: articles.html, status: articles.status })
    .from(articles);
  const publishedOverrides = new Map(
    currentRows
      .filter((row) => row.status === "published")
      .map((row) => [row.id, row.html]),
  );

  return recoveredArticles.map((article) => ({
    article,
    html: publishedOverrides.get(article.id) ?? article.content.html,
  }));
}

async function upsertRecoveredArticleOverride(
  article: ContentItem,
  html: string,
  actor: string,
) {
  const db = getDb();
  const now = new Date();
  const values = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    pathname: article.pathname,
    status: "published" as const,
    excerpt: article.excerpt ?? null,
    html,
    author: article.author ?? null,
    categories: article.categories,
    tags: article.tags,
    featuredImage: article.featuredImage ?? null,
    seo: article.seo,
    publishedAt: new Date(article.publishedAt),
    modifiedAt: now,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };

  const [existing] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, article.id))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(articles)
      .set({
        ...values,
        id: undefined,
        createdAt: undefined,
      })
      .where(eq(articles.id, article.id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(articles).values(values).returning();
  return inserted;
}
