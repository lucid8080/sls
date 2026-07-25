import type { ArticleRow } from "@/lib/cms/db/schema";
import { normalizeFeaturedImage } from "@/lib/cms/featured-image";
import type { ArticleExport } from "@/lib/cms/schemas";

export function articleRowToExport(row: ArticleRow): ArticleExport {
  return {
    id: row.id,
    type: "article",
    title: row.title,
    slug: row.slug,
    pathname: row.pathname,
    status: "published",
    excerpt: row.excerpt ?? undefined,
    publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
    modifiedAt: row.modifiedAt?.toISOString(),
    author: row.author ?? undefined,
    categories: row.categories ?? [],
    tags: row.tags ?? [],
    featuredImage: normalizeFeaturedImage(row.featuredImage),
    content: {
      kind: "html",
      html: row.html,
    },
    seo: row.seo,
  };
}
