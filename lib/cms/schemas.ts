import { z } from "zod";

export const EXECUTABLE_CONTENT_RE =
  /<\s*script|<\s*iframe|javascript:|data\s*:\s*text\/html|<\?(?:php)?|\bon[a-z]+\s*=|wp-admin|wp-login/i;

export const BLOCKED_PUBLIC_RE =
  /\b(casino|pokies?|slots?|blackjack|gambling|roulette|bingo|free spins?|no deposit|real cash|wagering|jackpot|betting)\b/i;

export const ARTICLE_STATUSES = ["draft", "in_review", "scheduled", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const AGENT_SCOPES = ["agent:read", "agent:write", "agent:publish", "agent:calendar"] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

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
  ogImage: z.string().optional(),
  noindex: z.boolean(),
});

export const ArticleSchema = z.object({
  id: z.string().min(1),
  type: z.literal("article"),
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

export const CmsExportBundleSchema = z.object({
  generatedAt: z.string(),
  articles: z.array(ArticleSchema),
});

export type TaxonomyTerm = z.infer<typeof TaxonomyTermSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type FeaturedImage = z.infer<typeof FeaturedImageSchema>;
export type ArticleExport = z.infer<typeof ArticleSchema>;

export function slugifyTitle(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/&[a-z0-9#]+;/gi, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "article"
  );
}

export function pathnameFromSlug(slug: string): string {
  const normalized = slug.replace(/^\/+|\/+$/g, "");
  return `/${normalized}/`;
}
