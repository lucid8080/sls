import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { z } from "zod";
import { ArticleSchema } from "@/lib/cms/schemas";

const taxonomyTermSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const imageVariantSchema = z.object({
  src: z.string().startsWith("/"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const featuredImageSchema = imageVariantSchema.extend({
  alt: z.string(),
  caption: z.string().optional(),
  variants: z
    .object({
      thumbnail: imageVariantSchema.optional(),
      card: imageVariantSchema.optional(),
      large: imageVariantSchema.optional(),
    })
    .optional(),
});

const contentItemSchema = z.object({
  id: z.string(),
  type: z.enum(["article", "page"]),
  title: z.string(),
  slug: z.string(),
  pathname: z.string().startsWith("/"),
  status: z.literal("published"),
  excerpt: z.string().optional(),
  publishedAt: z.string(),
  modifiedAt: z.string().optional(),
  author: authorSchema.optional(),
  categories: z.array(taxonomyTermSchema),
  tags: z.array(taxonomyTermSchema),
  featuredImage: featuredImageSchema.optional(),
  content: z.object({
    kind: z.literal("html"),
    html: z.string(),
  }),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    canonicalPath: z.string().startsWith("/"),
    ogImage: z.string().optional(),
    noindex: z.boolean(),
  }),
});

const contentBundleSchema = z.object({
  generatedAt: z.string(),
  articles: z.array(contentItemSchema.extend({ type: z.literal("article") })),
  pages: z.array(contentItemSchema.extend({ type: z.literal("page") })),
  authors: z.array(authorSchema),
  categories: z.array(taxonomyTermSchema),
  tags: z.array(taxonomyTermSchema),
});

export type TaxonomyTerm = z.infer<typeof taxonomyTermSchema>;
export type Author = z.infer<typeof authorSchema>;
export type ContentItem = z.infer<typeof contentItemSchema>;

const BLOCKED_PUBLIC_RE =
  /\b(casino|pokies?|slots?|blackjack|gambling|roulette|bingo|free spins?|no deposit|real cash|wagering|jackpot|betting)\b/i;
const CORE_CATEGORY_SLUGS = new Set([
  "lifestyle",
  "smart-cooking",
  "home-care",
  "smart-cleaning",
  "blog",
  "multi-function",
  "robot-vacuums",
  "flooring",
  "comparisons",
  "appliances",
  "travel",
  "air-quality",
  "checklist",
  "miscellaneous",
  "buyers-guide",
  "robot-mower",
  "duster",
]);

export const siteUrl = "https://simplelifesaver.com";
export const siteName = "Simple Life Saver";

export const getRecoveredContentBundle = cache(() => {
  const legacyPath = join(process.cwd(), "content", "content-bundle.json");
  const parsed = JSON.parse(readFileSync(legacyPath, "utf8")) as unknown;
  return contentBundleSchema.parse(parsed);
});

export const getContentBundle = cache(() => {
  const cmsPath = join(process.cwd(), "content", "cms-export.json");
  const bundle = getRecoveredContentBundle();
  const cmsArticles = readCmsArticles(cmsPath);
  const mergedArticles = dedupeArticles([...bundle.articles, ...cmsArticles]);
  const articles = mergedArticles.filter(isPublicContent).sort(sortNewestFirst);
  const pages = bundle.pages.filter(isPublicContent).sort(sortAlphabetically);
  const categories = bundle.categories
    .filter((category) => CORE_CATEGORY_SLUGS.has(category.slug))
    .filter((category) => articles.some((article) => article.categories.some((term) => term.slug === category.slug)))
    .sort(sortAlphabetically);
  const authors = bundle.authors
    .filter((author) => articles.some((article) => article.author?.id === author.id))
    .sort(sortAlphabetically);

  return {
    generatedAt: bundle.generatedAt,
    articles,
    pages,
    categories,
    authors,
    allPublicItems: [...articles, ...pages].sort(sortNewestFirst),
  };
});

export function getItemByPathname(pathname: string): ContentItem | undefined {
  const normalized = normalizePathname(pathname);
  return getContentBundle().allPublicItems.find((item) => normalizePathname(item.pathname) === normalized);
}

export function getCategory(slug: string): TaxonomyTerm | undefined {
  return getContentBundle().categories.find((category) => category.slug === slug);
}

export function getArticlesByCategory(slug: string): ContentItem[] {
  return getContentBundle().articles.filter((article) => article.categories.some((category) => category.slug === slug));
}

export function getAuthor(slug: string): Author | undefined {
  return getContentBundle().authors.find((author) => author.slug === slug);
}

export function getArticlesByAuthor(slug: string): ContentItem[] {
  return getContentBundle().articles.filter((article) => article.author?.slug === slug);
}

export function getRelatedArticles(item: ContentItem, limit = 3): ContentItem[] {
  const categorySlugs = new Set(item.categories.map((category) => category.slug));
  return getContentBundle()
    .articles.filter((article) => article.id !== item.id)
    .filter((article) => article.categories.some((category) => categorySlugs.has(category.slug)))
    .slice(0, limit);
}

/** Recent same-category guides first, then newest overall — used for the article right rail. */
export function getTrendingArticles(item: ContentItem, limit = 5): ContentItem[] {
  const related = getRelatedArticles(item, limit);
  if (related.length >= limit) {
    return related;
  }

  const seen = new Set([item.id, ...related.map((article) => article.id)]);
  const fillers = getContentBundle()
    .articles.filter((article) => !seen.has(article.id))
    .slice(0, limit - related.length);

  return [...related, ...fillers];
}

export function searchContent(query: string): ContentItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return getContentBundle()
    .articles.filter((item) => {
      const haystack = [item.title, item.excerpt, item.categories.map((category) => category.name).join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, 40);
}

export function normalizePathname(pathname: string): string {
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

export function pathnameToSegments(pathname: string): string[] {
  return normalizePathname(pathname)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
}

export function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function readingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function extractHeadings(html: string): Array<{ id: string; text: string }> {
  const matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)];
  return matches
    .map((match) => stripTags(match[1] ?? ""))
    .filter(Boolean)
    .slice(0, 12)
    .map((text) => ({
      id: slugify(text),
      text,
    }));
}

export function addHeadingIds(html: string): string {
  return html.replace(/<h2([^>]*)>(.*?)<\/h2>/gis, (full, attrs: string, inner: string) => {
    if (/\sid=/.test(attrs)) {
      return full;
    }

    const id = slugify(stripTags(inner));
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
}

function isPublicContent(item: ContentItem): boolean {
  if (item.seo.noindex || item.status !== "published") {
    return false;
  }

  const categoryAllowed =
    item.type === "page" || item.categories.some((category) => CORE_CATEGORY_SLUGS.has(category.slug));
  const publicText = [item.title, item.slug, item.pathname, item.excerpt].join(" ");
  return categoryAllowed && !BLOCKED_PUBLIC_RE.test(publicText);
}

function sortNewestFirst(left: ContentItem, right: ContentItem): number {
  return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
}

function sortAlphabetically<T extends { name?: string; title?: string }>(left: T, right: T): number {
  return (left.name ?? left.title ?? "").localeCompare(right.name ?? right.title ?? "");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/&[a-z0-9#]+;/gi, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "section"
  );
}

function readCmsArticles(cmsPath: string): z.infer<typeof contentItemSchema>[] {
  if (!existsSync(cmsPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(cmsPath, "utf8")) as unknown;
    const exportBundle = z
      .object({
        articles: z.array(ArticleSchema),
      })
      .parse(parsed);
    return exportBundle.articles;
  } catch {
    return [];
  }
}

function dedupeArticles<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}
