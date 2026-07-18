import {
  getContentBundle,
  siteName,
  siteUrl,
  type ContentItem,
} from "@/lib/content";

export type PublicSeoArtifacts = {
  sitemapXml: string;
  robotsTxt: string;
  rssXml: string;
};

function absoluteUrl(pathname: string): string {
  const url = new URL(siteUrl);
  if (pathname === "/") {
    url.pathname = "/";
  } else if (pathname.includes(".")) {
    url.pathname = pathname;
  } else {
    url.pathname = pathname.endsWith("/") ? pathname : `${pathname}/`;
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sitemapEntry(pathname: string, lastmod?: string): string {
  return `  <url>
    <loc>${xmlEscape(absoluteUrl(pathname))}</loc>${
      lastmod
        ? `
    <lastmod>${xmlEscape(lastmod)}</lastmod>`
        : ""
    }
  </url>`;
}

export function buildPublicSeoArtifacts(
  bundle = getContentBundle(),
): PublicSeoArtifacts {
  const urls = [
    sitemapEntry("/"),
    ...bundle.allPublicItems.map((item) =>
      sitemapEntry(item.pathname, item.modifiedAt ?? item.publishedAt),
    ),
    ...bundle.categories.map((category) => sitemapEntry(`/category/${category.slug}/`)),
    ...bundle.authors.map((author) => sitemapEntry(`/author/${author.slug}/`)),
    sitemapEntry("/search/"),
  ];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;

  const latestArticles = [...bundle.articles]
    .sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
    )
    .slice(0, 50);

  const items = latestArticles.map((article) => rssItem(article)).join("\n");

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(siteName)}</title>
    <link>${xmlEscape(absoluteUrl("/"))}</link>
    <description>Practical guides for smarter cooking, cleaning, home care, appliances, and everyday life.</description>
${items}
  </channel>
</rss>
`;

  return { sitemapXml, robotsTxt, rssXml };
}

function rssItem(article: ContentItem): string {
  const description = article.seo.description ?? article.excerpt ?? "";
  return `    <item>
      <title>${xmlEscape(article.title)}</title>
      <link>${xmlEscape(absoluteUrl(article.pathname))}</link>
      <guid>${xmlEscape(absoluteUrl(article.pathname))}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <description>${xmlEscape(description)}</description>
    </item>`;
}
