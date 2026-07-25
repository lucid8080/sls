import { unstable_cache } from "next/cache";
import { listPublishedArticles } from "@/lib/cms/articles";
import { listAuthorsForExport } from "@/lib/cms/authors";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { articleRowToExport } from "@/lib/cms/article-to-export";
import type { ArticleExport, Author } from "@/lib/cms/schemas";

export const CMS_CONTENT_TAG = "cms-content";

export type LiveCmsBundle = {
  articles: ArticleExport[];
  authors: Author[];
};

async function loadLiveCmsBundle(): Promise<LiveCmsBundle> {
  if (!isDatabaseConfigured()) {
    return { articles: [], authors: [] };
  }

  try {
    const rows = await listPublishedArticles();
    const articles = rows.map(articleRowToExport);
    const authors = await listAuthorsForExport();
    return { articles, authors };
  } catch (error) {
    console.error("[cms/live-bundle] Failed to load published CMS content from DB:", error);
    return { articles: [], authors: [] };
  }
}

/** Cached published CMS articles + authors. Invalidated via revalidateTag(CMS_CONTENT_TAG). */
const getCachedLiveCmsBundle = unstable_cache(loadLiveCmsBundle, ["live-cms-bundle"], {
  tags: [CMS_CONTENT_TAG],
});

export async function getLiveCmsBundle(): Promise<LiveCmsBundle> {
  // Vitest/scripts are outside the Next.js request cache runtime.
  if (process.env.VITEST) {
    return loadLiveCmsBundle();
  }
  return getCachedLiveCmsBundle();
}
