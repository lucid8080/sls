import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const EXECUTABLE_CONTENT_RE = /<\s*script|<\s*iframe|javascript:|data\s*:\s*text\/html|<\?(?:php)?|\bon[a-z]+\s*=|wp-admin|wp-login/i;

export const TaxonomyTermSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
});

export const AuthorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
});

const ImageVariantSchema = z.object({
  src: z.string().startsWith("/"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const FeaturedImageSchema = ImageVariantSchema.extend({
  alt: z.string(),
  caption: z.string().optional(),
  variants: z
    .object({
      thumbnail: ImageVariantSchema.optional(),
      card: ImageVariantSchema.optional(),
      large: ImageVariantSchema.optional(),
    })
    .optional(),
});

export const SafeContentRepresentationSchema = z.object({
  kind: z.literal("html"),
  html: z.string().refine((html) => !EXECUTABLE_CONTENT_RE.test(html), {
    message: "Safe content contains executable or WordPress-admin patterns.",
  }),
});

export const ContentSeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonicalPath: z.string().startsWith("/"),
  ogImage: z.string().startsWith("/").optional(),
  noindex: z.boolean(),
});

const BaseContentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  pathname: z.string().startsWith("/"),
  status: z.literal("published"),
  excerpt: z.string().optional(),
  publishedAt: z.string().min(1),
  modifiedAt: z.string().optional(),
  author: AuthorSchema.optional(),
  categories: z.array(TaxonomyTermSchema),
  tags: z.array(TaxonomyTermSchema),
  featuredImage: FeaturedImageSchema.optional(),
  content: SafeContentRepresentationSchema,
  seo: ContentSeoSchema,
});

export const ArticleSchema = BaseContentSchema.extend({
  type: z.literal("article"),
});

export const PageSchema = BaseContentSchema.extend({
  type: z.literal("page"),
});

export const MediaAssetSchema = z.object({
  sourcePath: z.string(),
  outputPath: z.string(),
  publicPath: z.string().startsWith("/"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  hash: z.string().min(1),
  mimeType: z.string().min(1),
});

export const RouteSchema = z.object({
  postId: z.string().min(1),
  originalAbsoluteUrl: z.string().url(),
  originalPathname: z.string().startsWith("/"),
  newPathname: z.string().startsWith("/"),
  contentType: z.enum(["post", "page"]),
  httpStatusExpectation: z.enum(["200", "manual-review"]),
  canonicalPath: z.string().startsWith("/"),
  redirectRequired: z.boolean(),
  redirectDestination: z.string().startsWith("/").optional(),
  reviewRequired: z.boolean(),
  reviewReasons: z.array(z.string()),
});

export const ReviewReportEntrySchema = z.object({
  postId: z.string().optional(),
  postTitle: z.string().optional(),
  postPathname: z.string().optional(),
  pathname: z.string().optional(),
  href: z.string().optional(),
  reason: z.string().min(1),
  preview: z.string().optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  manualReview: z.boolean(),
});

export const ContentBundleSchema = z.object({
  generatedAt: z.string().datetime(),
  articles: z.array(ArticleSchema),
  pages: z.array(PageSchema),
  authors: z.array(AuthorSchema),
  categories: z.array(TaxonomyTermSchema),
  tags: z.array(TaxonomyTermSchema),
  routes: z.array(RouteSchema),
  reports: z.object({
    excludedContent: z.array(
      z.object({
        id: z.string(),
        pathname: z.string(),
        reason: z.string(),
      }),
    ),
    validationWarnings: z.array(
      z.object({
        id: z.string().optional(),
        pathname: z.string().optional(),
        reason: z.string(),
      }),
    ),
  }),
});

export type ContentBundle = z.infer<typeof ContentBundleSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type Page = z.infer<typeof PageSchema>;
export type ContentModelSummary = {
  articles: number;
  pages: number;
  authors: number;
  categories: number;
  tags: number;
  routes: number;
  excludedContent: number;
  validationWarnings: number;
};

const LinkedArticleInputSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["post", "page"]),
  status: z.literal("publish"),
  title: z.string(),
  slug: z.string(),
  publishedAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  authorId: z.string().optional(),
  excerpt: z.string().optional(),
  pathname: z.string().startsWith("/"),
  featuredMedia: z
    .object({
      attachmentId: z.string().min(1),
      sourcePath: z.string().min(1),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      alt: z.string(),
      caption: z.string().optional(),
      sizes: z.array(
        z.object({
          name: z.string().min(1),
          sourcePath: z.string().min(1),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        }),
      ),
    })
    .optional(),
  sanitizedContent: z.string(),
});

const SeoInputSchema = z.object({
  id: z.string().min(1),
  pathname: z.string().startsWith("/"),
  type: z.enum(["post", "page"]),
  title: z.string(),
  description: z.string().optional(),
  canonicalPath: z.string().startsWith("/"),
  openGraph: z
    .object({
      image: z.string().optional(),
    })
    .passthrough(),
  author: AuthorSchema.optional(),
  categories: z.array(TaxonomyTermSchema),
  tags: z.array(TaxonomyTermSchema),
  noindex: z.boolean(),
});

export type ContentModelOptions = {
  includeNoindex?: boolean;
  mediaAccepted?: unknown;
};

const MediaAcceptedInputSchema = z.array(
  z.object({
    originalPath: z.string(),
    outputPath: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
);

type MediaAssetReference = {
  src: string;
  width?: number;
  height?: number;
};

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function buildContentBundle(
  linkedContentInput: unknown,
  seoInput: unknown,
  routesInput: unknown,
  options: ContentModelOptions = {},
): ContentBundle {
  const linkedContent = z.array(LinkedArticleInputSchema).parse(linkedContentInput);
  const seoMetadata = z.array(SeoInputSchema).parse(seoInput);
  const routes = z.array(RouteSchema).parse(routesInput);
  const mediaMap = buildMediaMap(options.mediaAccepted);
  const seoById = new Map(seoMetadata.map((seo) => [seo.id, seo]));
  const routeById = new Map(routes.map((route) => [route.postId, route]));
  const authors = new Map<string, z.infer<typeof AuthorSchema>>();
  const categories = new Map<string, z.infer<typeof TaxonomyTermSchema>>();
  const tags = new Map<string, z.infer<typeof TaxonomyTermSchema>>();
  const articles: Article[] = [];
  const pages: Page[] = [];
  const excludedContent: ContentBundle["reports"]["excludedContent"] = [];
  const validationWarnings: ContentBundle["reports"]["validationWarnings"] = [];
  const includedIds = new Set<string>();

  for (const item of linkedContent) {
    const seo = seoById.get(item.id);
    const route = routeById.get(item.id);

    if (!seo) {
      validationWarnings.push({ id: item.id, pathname: item.pathname, reason: "Missing SEO metadata for content item." });
      continue;
    }

    if (!route) {
      validationWarnings.push({ id: item.id, pathname: item.pathname, reason: "Missing route manifest entry for content item." });
      continue;
    }

    if (seo.noindex && !options.includeNoindex) {
      excludedContent.push({ id: item.id, pathname: item.pathname, reason: "Excluded because SEO metadata marks this item noindex." });
      continue;
    }

    if (seo.author) {
      authors.set(seo.author.id, seo.author);
    }

    for (const category of seo.categories) {
      categories.set(category.id, category);
    }

    for (const tag of seo.tags) {
      tags.set(tag.id, tag);
    }

    const normalizedOgImage = normalizeOgImage(seo.openGraph.image);
    const featuredImage = resolveFeaturedImage(item, normalizedOgImage, mediaMap, validationWarnings);
    const displayTitle = hasSeoTemplateResidue(seo.title) ? item.title : seo.title || item.title;
    const seoTitle = hasSeoTemplateResidue(seo.title) ? item.title : seo.title;
    const base = {
      id: item.id,
      title: displayTitle,
      slug: item.slug,
      pathname: route.canonicalPath,
      status: "published" as const,
      excerpt: seo.description ?? item.excerpt,
      publishedAt: normalizeDate(item.publishedAt),
      modifiedAt: item.modifiedAt ? normalizeDate(item.modifiedAt) : undefined,
      author: seo.author,
      categories: seo.categories,
      tags: seo.tags,
      featuredImage,
      content: {
        kind: "html" as const,
        html: item.sanitizedContent,
      },
      seo: {
        title: seoTitle,
        description: seo.description,
        canonicalPath: seo.canonicalPath,
        ogImage: featuredImage?.src,
        noindex: seo.noindex,
      },
    };

    const parsedContent =
      item.type === "post" ? ArticleSchema.safeParse({ ...base, type: "article" }) : PageSchema.safeParse({ ...base, type: "page" });

    if (!parsedContent.success) {
      validationWarnings.push({
        id: item.id,
        pathname: item.pathname,
        reason: `Excluded because content failed schema validation: ${parsedContent.error.issues.map((issue) => issue.message).join("; ")}`,
      });
      excludedContent.push({ id: item.id, pathname: item.pathname, reason: "Excluded because content failed schema validation." });
      continue;
    }

    if (parsedContent.data.type === "article") {
      articles.push(parsedContent.data);
    } else {
      pages.push(parsedContent.data);
    }
    includedIds.add(item.id);
  }

  return ContentBundleSchema.parse({
    generatedAt: new Date().toISOString(),
    articles,
    pages,
    authors: sortTerms([...authors.values()]),
    categories: sortTerms([...categories.values()]),
    tags: sortTerms([...tags.values()]),
    routes: routes.filter((route) => includedIds.has(route.postId)),
    reports: {
      excludedContent,
      validationWarnings,
    },
  });
}

export function writeContentBundle(outputDir: string, bundle: ContentBundle): ContentModelSummary {
  const articlesDir = join(outputDir, "articles");
  const pagesDir = join(outputDir, "pages");
  const authorsDir = join(outputDir, "authors");
  const categoriesDir = join(outputDir, "categories");
  const tagsDir = join(outputDir, "tags");
  const reportsDir = join(outputDir, "reports");

  for (const dir of [articlesDir, pagesDir, authorsDir, categoriesDir, tagsDir, reportsDir]) {
    mkdirSync(dir, { recursive: true });
  }

  for (const article of bundle.articles) {
    writeJson(join(articlesDir, `${safeFileName(article.slug)}-${article.id}.json`), article);
  }

  for (const page of bundle.pages) {
    writeJson(join(pagesDir, `${safeFileName(page.slug)}-${page.id}.json`), page);
  }

  for (const author of bundle.authors) {
    writeJson(join(authorsDir, `${safeFileName(author.slug)}.json`), author);
  }

  for (const category of bundle.categories) {
    writeJson(join(categoriesDir, `${safeFileName(category.slug)}.json`), category);
  }

  for (const tag of bundle.tags) {
    writeJson(join(tagsDir, `${safeFileName(tag.slug)}.json`), tag);
  }

  writeJson(join(outputDir, "content-bundle.json"), bundle);
  writeJson(join(outputDir, "routes.json"), bundle.routes);
  writeJson(join(reportsDir, "excluded-content.json"), bundle.reports.excludedContent);
  writeJson(join(reportsDir, "validation-warnings.json"), bundle.reports.validationWarnings);

  const summary = summarizeContentBundle(bundle);
  writeJson(join(outputDir, "summary.json"), summary);
  return summary;
}

export function summarizeContentBundle(bundle: ContentBundle): ContentModelSummary {
  return {
    articles: bundle.articles.length,
    pages: bundle.pages.length,
    authors: bundle.authors.length,
    categories: bundle.categories.length,
    tags: bundle.tags.length,
    routes: bundle.routes.length,
    excludedContent: bundle.reports.excludedContent.length,
    validationWarnings: bundle.reports.validationWarnings.length,
  };
}

function hasSeoTemplateResidue(value?: string): boolean {
  return Boolean(value && /%%\w+%%/.test(value));
}

function normalizeDate(value?: string): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

function normalizeOgImage(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    return normalizeMediaSource(parsed.pathname);
  } catch {
    return normalizeMediaSource(value);
  }
}

function buildMediaMap(mediaAcceptedInput: unknown): Map<string, MediaAssetReference> {
  const map = new Map<string, MediaAssetReference>();
  if (!mediaAcceptedInput) {
    return map;
  }

  const accepted = MediaAcceptedInputSchema.parse(mediaAcceptedInput);
  for (const item of accepted) {
    if (!item.outputPath) {
      continue;
    }

    map.set(normalizeMediaKey(`/media/${item.originalPath}`), {
      src: `/${normalizeSlashes(item.outputPath)}`,
      width: item.width,
      height: item.height,
    });
  }

  return map;
}

function resolveFeaturedImage(
  item: z.infer<typeof LinkedArticleInputSchema>,
  normalizedOgImage: string | undefined,
  mediaMap: Map<string, MediaAssetReference>,
  validationWarnings: ContentBundle["reports"]["validationWarnings"],
): z.infer<typeof FeaturedImageSchema> | undefined {
  const explicit = item.featuredMedia;
  if (explicit) {
    const resolved = resolveMediaAsset(explicit.sourcePath, mediaMap);
    if (resolved?.width && resolved.height) {
      const full = {
        src: resolved.src,
        width: resolved.width,
        height: resolved.height,
      };
      return {
        ...full,
        alt: explicit.alt || item.title,
        caption: explicit.caption,
        variants: resolveImageVariants(explicit, mediaMap, full),
      };
    }

    validationWarnings.push({
      id: item.id,
      pathname: item.pathname,
      reason: `Featured image '${explicit.sourcePath}' was not found in approved media output.`,
    });
  }

  const ogResolved = normalizedOgImage ? resolveMediaAsset(normalizedOgImage, mediaMap) : undefined;
  if (ogResolved?.width && ogResolved.height) {
    return {
      src: ogResolved.src,
      width: ogResolved.width,
      height: ogResolved.height,
      alt: item.title,
    };
  }

  const firstImage = extractFirstContentImage(item.sanitizedContent);
  const firstResolved = firstImage ? resolveMediaAsset(firstImage.src, mediaMap) : undefined;
  if (firstResolved?.width && firstResolved.height) {
    return {
      src: firstResolved.src,
      width: firstResolved.width,
      height: firstResolved.height,
      alt: firstImage?.alt || item.title,
    };
  }

  return undefined;
}

function resolveImageVariants(
  media: NonNullable<z.infer<typeof LinkedArticleInputSchema>["featuredMedia"]>,
  mediaMap: Map<string, MediaAssetReference>,
  fallback: z.infer<typeof ImageVariantSchema>,
): z.infer<typeof FeaturedImageSchema>["variants"] {
  const resolvedSizes = media.sizes
    .map((size) => {
      const asset = resolveMediaAsset(size.sourcePath, mediaMap);
      return asset?.width && asset.height
        ? {
            name: size.name,
            src: asset.src,
            width: asset.width,
            height: asset.height,
          }
        : undefined;
    })
    .filter(Boolean) as Array<z.infer<typeof ImageVariantSchema> & { name: string }>;

  const byName = new Map(resolvedSizes.map((size) => [size.name, size]));
  const thumbnail = byName.get("thumbnail") ?? smallestImage(resolvedSizes);
  const card =
    firstNamed(byName, ["medium_large", "medium", "foxiz_crop_g2", "foxiz_crop_g1", "entry", "entry-cropped", "post-thumbnail"]) ??
    firstMinWidth(resolvedSizes, 300) ??
    thumbnail ??
    fallback;
  const large = firstNamed(byName, ["large", "1536x1536", "medium_large"]) ?? fallback;

  return {
    thumbnail: toImageVariant(thumbnail),
    card: toImageVariant(card),
    large: toImageVariant(large),
  };
}

function resolveMediaAsset(sourcePath: string, mediaMap: Map<string, MediaAssetReference>): MediaAssetReference | undefined {
  const normalized = normalizeMediaSource(sourcePath);
  return normalized ? mediaMap.get(normalizeMediaKey(normalized)) : undefined;
}

function extractFirstContentImage(html: string): { src: string; alt: string } | undefined {
  const match = html.match(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/i);
  if (!match) {
    return undefined;
  }

  const attrs = `${match[1] ?? ""} ${match[3] ?? ""}`;
  return {
    src: match[2],
    alt: attrs.match(/\balt="([^"]*)"/i)?.[1] ?? "",
  };
}

function normalizeMediaSource(value: string): string | undefined {
  const normalized = `/${normalizeSlashes(value).replace(/^\/+/, "")}`;
  const uploadsMarker = "/wp-content/uploads/";
  const uploadsIndex = normalized.indexOf(uploadsMarker);
  if (uploadsIndex >= 0) {
    return `/media/${normalized.slice(uploadsIndex + uploadsMarker.length)}`;
  }

  if (normalized.startsWith("/media/")) {
    return normalized;
  }

  return normalized.match(/^\/\d{4}\/\d{2}\//) ? `/media${normalized}` : undefined;
}

function normalizeMediaKey(value: string): string {
  return `/${normalizeSlashes(value).replace(/^\/+/, "")}`.toLowerCase();
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function firstNamed<T>(map: Map<string, T>, names: string[]): T | undefined {
  for (const name of names) {
    const value = map.get(name);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function firstMinWidth<T extends { width: number }>(images: T[], width: number): T | undefined {
  return [...images].sort((left, right) => left.width - right.width).find((image) => image.width >= width);
}

function smallestImage<T extends { width: number; height: number }>(images: T[]): T | undefined {
  return [...images].sort((left, right) => left.width * left.height - right.width * right.height)[0];
}

function toImageVariant<T extends z.infer<typeof ImageVariantSchema> | undefined>(image: T): z.infer<typeof ImageVariantSchema> | undefined {
  return image ? { src: image.src, width: image.width, height: image.height } : undefined;
}

function sortTerms<T extends { slug: string }>(terms: T[]): T[] {
  return terms.sort((left, right) => left.slug.localeCompare(right.slug));
}

function safeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
