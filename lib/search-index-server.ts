import { cache } from "react";
import { getContentBundle, readingTime, type ContentItem } from "@/lib/content";
import type { SearchIndexEntry } from "@/lib/search-index";
import { searchIndex } from "@/lib/search-index";

export const getSearchIndex = cache(async (): Promise<SearchIndexEntry[]> => {
  const bundle = await getContentBundle();
  return bundle.articles.map(toSearchIndexEntry);
});

export async function searchPublicContent(query: string): Promise<SearchIndexEntry[]> {
  return searchIndex(query, await getSearchIndex());
}

function toSearchIndexEntry(article: ContentItem): SearchIndexEntry {
  const category = article.categories[0];
  const image =
    article.featuredImage?.variants?.card ??
    article.featuredImage?.variants?.thumbnail ??
    article.featuredImage;

  return {
    id: article.id,
    title: article.title,
    pathname: article.pathname,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    readingMinutes: readingTime(article.content.html),
    authorName: article.author?.name,
    categoryName: category?.name,
    categorySlug: category?.slug,
    imageSrc: image?.src,
    imageWidth: image?.width,
    imageHeight: image?.height,
    haystack: [article.title, article.excerpt, article.categories.map((term) => term.name).join(" ")]
      .join(" ")
      .toLowerCase(),
  };
}
