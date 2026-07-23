import { describe, expect, it } from "vitest";
import { recoveredArticleToAdminArticle } from "@/lib/cms/admin-articles";
import { normalizeMediaLookupKey, normalizeUploadsUrl } from "@/lib/cms/media-paths";
import { getMediaMap, getRecoveredMediaCatalog } from "@/lib/media";
import type { ContentItem } from "@/lib/content";

function article(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "101",
    type: "article",
    title: "Sample guide",
    slug: "sample-guide",
    pathname: "/sample-guide/",
    status: "published",
    excerpt: "Excerpt",
    publishedAt: "2025-01-01T00:00:00.000Z",
    modifiedAt: "2025-02-01T00:00:00.000Z",
    categories: [],
    tags: [],
    content: { kind: "html", html: "<p>Body</p>" },
    seo: { canonicalPath: "/sample-guide/", noindex: false },
    ...overrides,
  };
}

function resolveToPublicPath(rawPath: string): string | null {
  const mediaMap = getMediaMap();
  const catalogPaths = new Set(
    getRecoveredMediaCatalog().map((item) => item.publicPath.replace(/\/$/, "").toLowerCase()),
  );

  const normalizedUploads = normalizeUploadsUrl(rawPath);
  const mapped = mediaMap.get(normalizeMediaLookupKey(normalizedUploads));
  if (mapped) {
    return mapped.publicPath.replace(/\/$/, "").toLowerCase();
  }

  const directKey = normalizeMediaLookupKey(normalizedUploads);
  if (catalogPaths.has(directKey)) {
    return directKey;
  }

  if (directKey.startsWith("/media/")) {
    return directKey;
  }

  return null;
}

function collectPathsFromArticle(item: ContentItem): string[] {
  const adminArticle = recoveredArticleToAdminArticle(item);
  const paths: string[] = [];

  if (adminArticle.featuredImage && typeof adminArticle.featuredImage === "object") {
    const featured = adminArticle.featuredImage as {
      src?: string;
      variants?: { thumbnail?: { src?: string }; card?: { src?: string }; large?: { src?: string } };
    };
    if (featured.src) paths.push(featured.src);
    for (const variant of [featured.variants?.thumbnail, featured.variants?.card, featured.variants?.large]) {
      if (variant?.src) paths.push(variant.src);
    }
  }

  if (adminArticle.seo.ogImage) {
    paths.push(adminArticle.seo.ogImage);
  }

  for (const match of adminArticle.html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) {
    paths.push(match[1]);
  }

  return paths;
}

describe("media usage path resolution", () => {
  it("maps recovered featured image paths", () => {
    const resolved = resolveToPublicPath(
      "/media/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.jpg",
    );

    expect(resolved).toBe("/media/2019/11/21-dishwasher-hacks-for-the-modern-home-scaled-1.webp");
  });

  it("maps old WordPress upload URLs to recovered media paths", () => {
    const resolved = resolveToPublicPath(
      "https://simplelifesaver.com/wp-content/uploads/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.jpg",
    );

    expect(resolved).toBe("/media/2019/11/21-dishwasher-hacks-for-the-modern-home-scaled-1.webp");
  });

  it("collects featured, og, and inline image references from article content", () => {
    const item = article({
      featuredImage: {
        src: "/media/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.webp",
        alt: "Hero",
        width: 1024,
        height: 680,
      },
      seo: {
        canonicalPath: "/sample-guide/",
        noindex: false,
        ogImage: "/media/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.webp",
      },
      content: {
        kind: "html",
        html: '<p>Intro</p><img src="/media/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.webp" alt="">',
      },
    });

    const paths = collectPathsFromArticle(item);
    expect(paths).toHaveLength(3);
    expect(new Set(paths).size).toBe(1);
  });
});
