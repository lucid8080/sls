import { revalidatePath, revalidateTag } from "next/cache";
import { CMS_CONTENT_TAG } from "@/lib/cms/live-bundle";

export type RevalidateCmsContentInput = {
  pathname?: string | null;
  categorySlugs?: string[];
  authorSlug?: string | null;
};

/**
 * Bust the live CMS content cache and refresh the public pages that list this article.
 * Call from Route Handlers / Server Actions after publish or content mutations.
 */
export function revalidateCmsContent(input: RevalidateCmsContentInput = {}): void {
  revalidateTag(CMS_CONTENT_TAG, "max");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  revalidatePath("/rss.xml");

  if (input.pathname) {
    revalidatePath(input.pathname);
  }

  for (const slug of input.categorySlugs ?? []) {
    if (slug) {
      revalidatePath(`/category/${slug}`);
    }
  }

  if (input.authorSlug) {
    revalidatePath(`/author/${input.authorSlug}`);
  }
}
