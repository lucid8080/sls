import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RouteManifestEntry } from "./route.js";
import { SanitizedArticle } from "./sanitize.js";
import { ParsedWordPressDump, SqlRecord } from "./types.js";

export type SeoMetadata = {
  id: string;
  pathname: string;
  absoluteUrl: string;
  type: "post" | "page";
  title: string;
  description?: string;
  canonicalPath: string;
  canonicalUrl: string;
  openGraph: {
    title: string;
    description?: string;
    url: string;
    type: "article" | "website";
    image?: string;
  };
  twitter: {
    card: "summary" | "summary_large_image";
    title: string;
    description?: string;
    image?: string;
  };
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags: string[];
  };
  structuredData: {
    article?: Record<string, unknown>;
    breadcrumbs: Record<string, unknown>;
  };
  author?: TaxonomyTerm;
  categories: TaxonomyTerm[];
  tags: TaxonomyTerm[];
  noindex: boolean;
  source: {
    title: "yoast" | "rankMath" | "wordpress";
    description: "yoast" | "rankMath" | "excerpt" | "generated" | "none";
  };
};

export type TaxonomyTerm = {
  id: string;
  name: string;
  slug: string;
};

export type SeoReviewEntry = {
  postId: string;
  pathname: string;
  reason: string;
  preview: string;
  severity: "low" | "medium" | "high";
  manualReview: boolean;
};

export type SeoOutput = {
  metadata: SeoMetadata[];
  review: SeoReviewEntry[];
  sitemapXml: string;
  robotsTxt: string;
  rssXml: string;
};

type SeoBuildOptions = {
  siteUrl: string;
};

type TermTaxonomy = {
  termTaxonomyId: string;
  termId: string;
  taxonomy: string;
};

const SPAM_RE = /(casino|pokies?|slots?|blackjack|gambling|bonus codes?|real money|porn|viagra|cialis|levitra|pharma|loan|betting|hitclub|doctiplus)/i;
const EXECUTABLE_RE = /<\s*script|javascript:|data\s*:\s*text\/html|<\?(?:php)?|on[a-z]+\s*=/i;

export function readRouteManifest(path: string): RouteManifestEntry[] {
  return JSON.parse(readFileSync(path, "utf8")) as RouteManifestEntry[];
}

export function buildSeoOutput(
  dump: ParsedWordPressDump,
  articles: SanitizedArticle[],
  routes: RouteManifestEntry[],
  options: SeoBuildOptions,
): SeoOutput {
  const review: SeoReviewEntry[] = [];
  const metaByPost = groupPostMeta(dump.records.postmeta);
  const attachmentFilesById = buildAttachmentFileMap(dump.records.posts, metaByPost);
  const usersById = new Map(dump.records.users.map((user) => [getString(user, "ID"), user]));
  const taxonomy = buildTaxonomy(dump);
  const routesByPostId = new Map(routes.map((route) => [route.postId, route]));
  const site = new URL(options.siteUrl);

  const metadata = articles.map((article) => {
    const route = routesByPostId.get(article.id);
    const pathname = route?.newPathname ?? article.pathname;
    const pageAbsoluteUrl = absoluteUrl(options.siteUrl, pathname);
    const postMeta = metaByPost.get(article.id) ?? new Map<string, string>();
    const terms = taxonomy.termsByPostId.get(article.id) ?? [];
    const categories = terms.filter((term) => term.taxonomy === "category").map(toPublicTerm);
    const tags = terms.filter((term) => term.taxonomy === "post_tag").map(toPublicTerm);
    const authorTerm = terms.find((term) => term.taxonomy === "author");
    const user = usersById.get(article.authorId ?? "");
    const authorName = authorTerm?.name ?? (getString(user, "display_name") || undefined);
    const titleChoice = chooseTitle(article, postMeta, review, pathname);
    const descriptionChoice = chooseDescription(article, postMeta, review, pathname);
    const canonical = chooseCanonical(postMeta, pathname, site, review, article.id);
    const ogImage = chooseImage(postMeta, site, review, article.id, pathname, attachmentFilesById);
    const suspiciousSeo = review.some(
      (entry) => entry.postId === article.id && entry.severity === "high" && entry.reason.startsWith("Rejected suspicious"),
    );
    const noindex = hasNoindex(postMeta) || suspiciousSeo;

    const seo: SeoMetadata = {
      id: article.id,
      pathname,
      absoluteUrl: pageAbsoluteUrl,
      type: article.type,
      title: titleChoice.value,
      description: descriptionChoice.value,
      canonicalPath: canonical.pathname,
      canonicalUrl: absoluteUrl(options.siteUrl, canonical.pathname),
      openGraph: {
        title: titleChoice.value,
        description: descriptionChoice.value,
        url: pageAbsoluteUrl,
        type: article.type === "post" ? "article" : "website",
        image: ogImage,
      },
      twitter: {
        card: ogImage ? "summary_large_image" : "summary",
        title: titleChoice.value,
        description: descriptionChoice.value,
        image: ogImage,
      },
      article:
        article.type === "post"
          ? {
              publishedTime: isoDate(article.publishedAt),
              modifiedTime: isoDate(article.modifiedAt),
              author: authorName,
              section: categories[0]?.name,
              tags: tags.map((tag) => tag.name),
            }
          : undefined,
      structuredData: {
        article:
          article.type === "post"
            ? articleStructuredData(article, titleChoice.value, descriptionChoice.value, pageAbsoluteUrl, authorName, categories, tags)
            : undefined,
        breadcrumbs: breadcrumbStructuredData(options.siteUrl, pathname, article.title),
      },
      author: authorTerm ? toPublicTerm(authorTerm) : undefined,
      categories,
      tags,
      noindex,
      source: {
        title: titleChoice.source,
        description: descriptionChoice.source,
      },
    };

    if (noindex) {
      addReview(
        review,
        article.id,
        pathname,
        suspiciousSeo ? "Suspicious SEO/content signals excluded this entry from sitemap and RSS." : "Recovered metadata marks this content noindex.",
        "noindex",
        suspiciousSeo ? "high" : "medium",
      );
    }

    return seo;
  });

  const indexable = metadata.filter((entry) => !entry.noindex);

  return {
    metadata,
    review,
    sitemapXml: buildSitemap(indexable),
    robotsTxt: buildRobotsTxt(options.siteUrl),
    rssXml: buildRss(indexable, options.siteUrl),
  };
}

export function writeSeoOutput(outputDir: string, output: SeoOutput): void {
  mkdirSync(join(outputDir, "reports"), { recursive: true });
  writeJson(join(outputDir, "seo-metadata.json"), output.metadata);
  writeFileSync(join(outputDir, "sitemap.xml"), output.sitemapXml, "utf8");
  writeFileSync(join(outputDir, "robots.txt"), output.robotsTxt, "utf8");
  writeFileSync(join(outputDir, "rss.xml"), output.rssXml, "utf8");
  writeJson(join(outputDir, "reports", "seo-review.json"), output.review);
}

export function writeSeoOutputToProject(projectRoot: string, output: SeoOutput): void {
  mkdirSync(join(projectRoot, "data"), { recursive: true });
  mkdirSync(join(projectRoot, "reports"), { recursive: true });
  writeJson(join(projectRoot, "data", "seo-metadata.json"), output.metadata);
  writeFileSync(join(projectRoot, "sitemap.xml"), output.sitemapXml, "utf8");
  writeFileSync(join(projectRoot, "robots.txt"), output.robotsTxt, "utf8");
  writeFileSync(join(projectRoot, "rss.xml"), output.rssXml, "utf8");
  writeJson(join(projectRoot, "reports", "seo-review.json"), output.review);
}

function chooseTitle(
  article: SanitizedArticle,
  postMeta: Map<string, string>,
  review: SeoReviewEntry[],
  pathname: string,
): { value: string; source: SeoMetadata["source"]["title"] } {
  const choices: Array<{ value?: string; source: SeoMetadata["source"]["title"] }> = [
    { value: postMeta.get("_yoast_wpseo_title"), source: "yoast" },
    { value: postMeta.get("rank_math_title"), source: "rankMath" },
    { value: article.title, source: "wordpress" },
  ];

  for (const choice of choices) {
    const resolved =
      choice.source === "wordpress"
        ? choice.value
        : resolveTitleTemplate(choice.value, article.title);
    const sanitized = sanitizeMetaText(resolved, article.id, pathname, "SEO title", review);
    if (sanitized) {
      return { value: sanitized, source: choice.source };
    }
  }

  return { value: "Untitled", source: "wordpress" };
}

/** Resolve Yoast/Rank Math title tokens using the WordPress post title. */
function resolveTitleTemplate(value: string | undefined, articleTitle: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/%%title%%/gi, articleTitle)
    .replace(/%%page%%/gi, "")
    .replace(/%%sitename%%/gi, "Simple Lifesaver")
    .replace(/%%sep%%/gi, "-")
    .replace(/%%\w+%%/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseDescription(
  article: SanitizedArticle,
  postMeta: Map<string, string>,
  review: SeoReviewEntry[],
  pathname: string,
): { value?: string; source: SeoMetadata["source"]["description"] } {
  const choices: Array<{ value?: string; source: SeoMetadata["source"]["description"] }> = [
    { value: postMeta.get("_yoast_wpseo_metadesc"), source: "yoast" },
    { value: postMeta.get("rank_math_description"), source: "rankMath" },
    { value: article.excerpt, source: "excerpt" },
    { value: textExcerpt(article.sanitizedContent), source: "generated" },
  ];

  for (const choice of choices) {
    const sanitized = sanitizeMetaText(choice.value, article.id, pathname, "SEO description", review);
    if (sanitized) {
      return { value: sanitized.slice(0, 180), source: choice.source };
    }
  }

  return { source: "none" };
}

function chooseCanonical(
  postMeta: Map<string, string>,
  fallbackPathname: string,
  site: URL,
  review: SeoReviewEntry[],
  postId: string,
): { pathname: string } {
  const raw = postMeta.get("_yoast_wpseo_canonical") ?? postMeta.get("rank_math_canonical_url");
  if (!raw) {
    return { pathname: fallbackPathname };
  }

  try {
    const parsed = new URL(raw);
    if (parsed.hostname !== site.hostname) {
      addReview(review, postId, fallbackPathname, "Rejected canonical URL on unapproved domain.", raw, "high");
      return { pathname: fallbackPathname };
    }
    return { pathname: parsed.pathname || fallbackPathname };
  } catch {
    addReview(review, postId, fallbackPathname, "Rejected malformed canonical URL.", raw, "medium");
    return { pathname: fallbackPathname };
  }
}

function chooseImage(
  postMeta: Map<string, string>,
  site: URL,
  review: SeoReviewEntry[],
  postId: string,
  pathname: string,
  attachmentFilesById: Map<string, string>,
): string | undefined {
  const raw =
    postMeta.get("_yoast_wpseo_opengraph-image") ??
    postMeta.get("rank_math_facebook_image") ??
    postMeta.get("rank_math_twitter_image") ??
    featuredImageUrl(postMeta.get("_thumbnail_id"), attachmentFilesById, site);

  if (!raw) {
    return undefined;
  }

  try {
    const parsed = new URL(raw, site);
    if (parsed.hostname !== site.hostname) {
      addReview(review, postId, pathname, "Rejected Open Graph image on unapproved domain.", raw, "medium");
      return undefined;
    }
    return parsed.toString();
  } catch {
    addReview(review, postId, pathname, "Rejected malformed Open Graph image URL.", raw, "medium");
    return undefined;
  }
}

function featuredImageUrl(attachmentId: string | undefined, attachmentFilesById: Map<string, string>, site: URL): string | undefined {
  if (!attachmentId) {
    return undefined;
  }

  const sourcePath = attachmentFilesById.get(attachmentId);
  if (!sourcePath) {
    return undefined;
  }

  const url = new URL(site);
  url.pathname = `/wp-content/uploads/${sourcePath.replace(/^\/+/, "")}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function sanitizeMetaText(
  value: string | undefined,
  postId: string,
  pathname: string,
  fieldName: string,
  review: SeoReviewEntry[],
): string | undefined {
  if (!value) {
    return undefined;
  }

  const stripped = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) {
    return undefined;
  }

  if (EXECUTABLE_RE.test(value) || SPAM_RE.test(value)) {
    addReview(review, postId, pathname, `Rejected suspicious ${fieldName}.`, value, "high");
    return undefined;
  }

  const cleaned = stripped
    .replace(/%%title%%/gi, "")
    .replace(/%%page%%/gi, "")
    .replace(/%%sitename%%/gi, "Simple Lifesaver")
    .replace(/%%sep%%/gi, "-")
    .replace(/%%\w+%%/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /%%\w+%%/.test(cleaned)) {
    return undefined;
  }
  return cleaned;
}

function hasNoindex(postMeta: Map<string, string>): boolean {
  return (
    postMeta.get("_yoast_wpseo_meta-robots-noindex") === "1" ||
    (postMeta.get("rank_math_robots") ?? "").includes("noindex")
  );
}

function buildTaxonomy(dump: ParsedWordPressDump): {
  termsByPostId: Map<string, Array<TaxonomyTerm & { taxonomy: string }>>;
} {
  const termsById = new Map(dump.records.terms.map((term) => [getString(term, "term_id"), term]));
  const taxonomyById = new Map<string, TermTaxonomy>();
  for (const row of dump.records.term_taxonomy) {
    taxonomyById.set(getString(row, "term_taxonomy_id"), {
      termTaxonomyId: getString(row, "term_taxonomy_id"),
      termId: getString(row, "term_id"),
      taxonomy: getString(row, "taxonomy"),
    });
  }

  const termsByPostId = new Map<string, Array<TaxonomyTerm & { taxonomy: string }>>();
  for (const relationship of dump.records.term_relationships) {
    const postId = getString(relationship, "object_id");
    const taxonomy = taxonomyById.get(getString(relationship, "term_taxonomy_id"));
    const term = taxonomy ? termsById.get(taxonomy.termId) : undefined;
    if (!taxonomy || !term) {
      continue;
    }

    const existing = termsByPostId.get(postId) ?? [];
    existing.push({
      id: taxonomy.termId,
      name: getString(term, "name"),
      slug: getString(term, "slug"),
      taxonomy: taxonomy.taxonomy,
    });
    termsByPostId.set(postId, existing);
  }

  return { termsByPostId };
}

function articleStructuredData(
  article: SanitizedArticle,
  title: string,
  description: string | undefined,
  url: string,
  author: string | undefined,
  categories: TaxonomyTerm[],
  tags: TaxonomyTerm[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    datePublished: isoDate(article.publishedAt),
    dateModified: isoDate(article.modifiedAt),
    author: author ? { "@type": "Person", name: author } : undefined,
    articleSection: categories[0]?.name,
    keywords: tags.map((tag) => tag.name).join(", "),
  };
}

function breadcrumbStructuredData(siteUrl: string, pathname: string, title: string): Record<string, unknown> {
  const segments = pathname.split("/").filter(Boolean);
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl(siteUrl, "/"),
    },
  ];

  let current = "";
  segments.forEach((segment, index) => {
    current += `/${segment}`;
    items.push({
      "@type": "ListItem",
      position: index + 2,
      name: index === segments.length - 1 ? title : segment.replace(/-/g, " "),
      item: absoluteUrl(siteUrl, `${current}/`),
    });
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

function buildSitemap(metadata: SeoMetadata[]): string {
  const urls = metadata
    .map(
      (entry) => `  <url>
    <loc>${xmlEscape(entry.canonicalUrl)}</loc>${entry.article?.modifiedTime ? `
    <lastmod>${xmlEscape(entry.article.modifiedTime)}</lastmod>` : ""}
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRobotsTxt(siteUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl(siteUrl, "/sitemap.xml")}
`;
}

function buildRss(metadata: SeoMetadata[], siteUrl: string): string {
  const latest = metadata
    .filter((entry) => entry.type === "post")
    .sort((a, b) => (b.article?.publishedTime ?? "").localeCompare(a.article?.publishedTime ?? ""))
    .slice(0, 50);
  const items = latest
    .map(
      (entry) => `    <item>
      <title>${xmlEscape(entry.title)}</title>
      <link>${xmlEscape(entry.absoluteUrl)}</link>
      <guid>${xmlEscape(entry.absoluteUrl)}</guid>${entry.article?.publishedTime ? `
      <pubDate>${new Date(entry.article.publishedTime).toUTCString()}</pubDate>` : ""}
      <description>${xmlEscape(entry.description ?? "")}</description>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Simple Lifesaver</title>
    <link>${xmlEscape(absoluteUrl(siteUrl, "/"))}</link>
    <description>Recovered Simple Lifesaver content feed</description>
${items}
  </channel>
</rss>
`;
}

function textExcerpt(html: string): string | undefined {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 170) : undefined;
}

function toPublicTerm(term: TaxonomyTerm): TaxonomyTerm {
  return {
    id: term.id,
    name: term.name,
    slug: term.slug,
  };
}

function isoDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function absoluteUrl(siteUrl: string, pathname: string): string {
  const url = new URL(siteUrl);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getString(record: SqlRecord | undefined, key: string): string {
  return record?.[key] ?? "";
}

function addReview(
  review: SeoReviewEntry[],
  postId: string,
  pathname: string,
  reason: string,
  preview: string,
  severity: SeoReviewEntry["severity"],
): void {
  review.push({
    postId,
    pathname,
    reason,
    preview: preview.replace(/\s+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 180),
    severity,
    manualReview: severity !== "low",
  });
}

function groupPostMeta(rows: SqlRecord[]): Map<string, Map<string, string>> {
  const grouped = new Map<string, Map<string, string>>();
  for (const row of rows) {
    const postId = getString(row, "post_id");
    const key = getString(row, "meta_key");
    if (!postId || !key) {
      continue;
    }
    const meta = grouped.get(postId) ?? new Map<string, string>();
    meta.set(key, getString(row, "meta_value"));
    grouped.set(postId, meta);
  }
  return grouped;
}

function buildAttachmentFileMap(posts: SqlRecord[], metaByPost: Map<string, Map<string, string>>): Map<string, string> {
  const map = new Map<string, string>();
  for (const post of posts) {
    if (getString(post, "post_type") !== "attachment") {
      continue;
    }

    const id = getString(post, "ID");
    const attachedFile = metaByPost.get(id)?.get("_wp_attached_file");
    if (id && attachedFile) {
      map.set(id, attachedFile);
    }
  }

  return map;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
