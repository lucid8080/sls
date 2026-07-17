import type { ArticleRow } from "@/lib/cms/db/schema";

export function serializeArticle(row: ArticleRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    pathname: row.pathname,
    status: row.status,
    excerpt: row.excerpt,
    html: row.html,
    author: row.author,
    categories: row.categories,
    tags: row.tags,
    featuredImage: row.featuredImage,
    seo: row.seo,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    modifiedAt: row.modifiedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
