import { getRecoveredContentBundle, type ContentItem } from "@/lib/content";
import { getArticleById, listArticles } from "@/lib/cms/articles";
import { getDb } from "@/lib/cms/db/client";
import { articles, type ArticleRow } from "@/lib/cms/db/schema";
import { serializeArticle } from "@/lib/cms/serialize";
import type { ArticleStatus } from "@/lib/cms/schemas";

export type AdminArticle = ReturnType<typeof serializeArticle> & {
  source: "database" | "recovered";
};

export type AdminArticleFilters = {
  status?: ArticleStatus;
  search?: string;
};

export function recoveredArticleToAdminArticle(article: ContentItem): AdminArticle {
  const publishedAt = article.publishedAt;
  const modifiedAt = article.modifiedAt ?? publishedAt;

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    pathname: article.pathname,
    status: "published",
    excerpt: article.excerpt ?? null,
    html: article.content.html,
    author: article.author ?? null,
    categories: article.categories,
    tags: article.tags,
    featuredImage: article.featuredImage ?? null,
    seo: article.seo,
    publishedAt,
    modifiedAt,
    scheduledAt: null,
    createdAt: publishedAt,
    updatedAt: modifiedAt,
    source: "recovered",
  };
}

export function databaseArticleToAdminArticle(row: ArticleRow): AdminArticle {
  return {
    ...serializeArticle(row),
    source: "database",
  };
}

export function combineAdminArticles(
  databaseArticles: AdminArticle[],
  recoveredArticles: ContentItem[],
  filters: AdminArticleFilters = {},
): AdminArticle[] {
  const byId = new Map<string, AdminArticle>();

  for (const article of recoveredArticles) {
    byId.set(article.id, recoveredArticleToAdminArticle(article));
  }
  for (const article of databaseArticles) {
    byId.set(article.id, article);
  }

  const search = filters.search?.trim().toLowerCase();
  return [...byId.values()]
    .filter((article) => !filters.status || article.status === filters.status)
    .filter(
      (article) =>
        !search ||
        article.title.toLowerCase().includes(search) ||
        article.slug.toLowerCase().includes(search),
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function listAdminArticles(filters: AdminArticleFilters = {}): Promise<AdminArticle[]> {
  const rows = await listArticles({ limit: 1000 });
  const databaseArticles = rows.map(databaseArticleToAdminArticle);
  return combineAdminArticles(databaseArticles, getRecoveredContentBundle().articles, filters);
}

export async function getAdminArticleById(id: string): Promise<AdminArticle | undefined> {
  const row = await getArticleById(id);
  if (row) {
    return databaseArticleToAdminArticle(row);
  }

  const recovered = getRecoveredContentBundle().articles.find((article) => article.id === id);
  return recovered ? recoveredArticleToAdminArticle(recovered) : undefined;
}

export async function ensureRecoveredArticleOverride(
  id: string,
  actor: string,
): Promise<ArticleRow | undefined> {
  const existing = await getArticleById(id);
  if (existing) {
    return existing;
  }

  const bundle = getRecoveredContentBundle();
  const recovered =
    bundle.articles.find((article) => article.id === id) ??
    bundle.pages.find((page) => page.id === id);
  if (!recovered) {
    return undefined;
  }

  const publishedAt = new Date(recovered.publishedAt);
  const modifiedAt = new Date(recovered.modifiedAt ?? recovered.publishedAt);
  const [inserted] = await getDb()
    .insert(articles)
    .values({
      id: recovered.id,
      title: recovered.title,
      slug: recovered.slug,
      pathname: recovered.pathname,
      status: "published",
      excerpt: recovered.excerpt,
      html: recovered.content.html,
      author: recovered.author ?? null,
      categories: recovered.categories,
      tags: recovered.tags,
      featuredImage: recovered.featuredImage ?? null,
      seo: recovered.seo,
      publishedAt,
      modifiedAt,
      createdBy: actor,
      createdAt: publishedAt,
      updatedAt: modifiedAt,
    })
    .returning();

  return inserted;
}
