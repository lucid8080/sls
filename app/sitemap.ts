import type { MetadataRoute } from "next";
import { getContentBundle, siteUrl } from "@/lib/content";

function absoluteUrl(pathname: string): string {
  const url = new URL(siteUrl);
  if (pathname === "/") {
    url.pathname = "/";
  } else {
    url.pathname = pathname.endsWith("/") ? pathname : `${pathname}/`;
  }
  return url.toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const bundle = await getContentBundle();

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/search/"), changeFrequency: "weekly", priority: 0.5 },
    ...bundle.allPublicItems.map((item) => ({
      url: absoluteUrl(item.pathname),
      lastModified: item.modifiedAt ?? item.publishedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...bundle.categories.map((category) => ({
      url: absoluteUrl(`/category/${category.slug}/`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...bundle.authors.map((author) => ({
      url: absoluteUrl(`/author/${author.slug}/`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
