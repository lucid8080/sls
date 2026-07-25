import { z } from "zod";

export const EXECUTABLE_CONTENT_RE =
  /<\s*script|<\s*iframe|javascript:|data\s*:\s*text\/html|<\?(?:php)?|\bon[a-z]+\s*=|wp-admin|wp-login/i;

export const BLOCKED_PUBLIC_RE =
  /\b(casino|pokies?|slots?|blackjack|gambling|roulette|bingo|free spins?|no deposit|real cash|wagering|jackpot|betting)\b/i;

/** Categories allowed on the public static site (`lib/content.ts` isPublicContent). */
export const CORE_CATEGORY_SLUGS = new Set([
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
  "ai-tools",
  "hardware",
  "developer-tools",
]);

export function hasPublicCategory(categories: Array<{ slug: string }>): boolean {
  return categories.some((category) => CORE_CATEGORY_SLUGS.has(category.slug));
}

export const ARTICLE_STATUSES = ["draft", "in_review", "scheduled", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const AGENT_SCOPES = [
  "agent:read",
  "agent:write",
  "agent:publish",
  "agent:calendar",
  "agent:ads",
  "agent:affiliates",
  "agent:media",
  "agent:topics",
] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

export const DEFAULT_AGENT_SCOPES: AgentScope[] = ["agent:read", "agent:write", "agent:calendar"];

export const AGENT_SCOPE_DESCRIPTIONS: Record<AgentScope, string> = {
  "agent:read": "Read articles, jobs, internal search",
  "agent:write": "Create and update article drafts",
  "agent:publish": "Publish approved articles",
  "agent:calendar": "Read content calendar slots",
  "agent:ads": "Read and update ad placement settings",
  "agent:affiliates": "Manage affiliate links",
  "agent:media": "List, upload, edit, and delete media",
  "agent:topics": "Manage the topic inbox",
};

export function isAgentScope(value: unknown): value is AgentScope {
  return typeof value === "string" && (AGENT_SCOPES as readonly string[]).includes(value);
}

export type AgentScopeParseResult =
  | { ok: true; scopes: AgentScope[] }
  | { ok: false; error: string };

/** Validates a caller-supplied scope list against the catalog, preserving catalog order. */
export function parseAgentScopes(value: unknown): AgentScopeParseResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: "scopes must be an array." };
  }

  const invalid = value.filter((scope) => !isAgentScope(scope));
  if (invalid.length > 0) {
    return { ok: false, error: `Unknown scopes: ${invalid.map(String).join(", ")}` };
  }

  const selected = new Set(value as AgentScope[]);
  const scopes = AGENT_SCOPES.filter((scope) => selected.has(scope));
  if (scopes.length === 0) {
    return { ok: false, error: "At least one scope is required." };
  }

  return { ok: true, scopes };
}

export const TaxonomyTermSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
});

export const AuthorSocialsSchema = z.object({
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  facebook: z.string().optional(),
  website: z.string().optional(),
});

export const AuthorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  bio: z.string().optional(),
  avatarPath: z.string().startsWith("/").optional().nullable(),
  socials: AuthorSocialsSchema.optional(),
});

/** Lightweight snapshot stored on articles (id/name/slug only). */
export const ArticleAuthorSnapshotSchema = z.object({
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
  author: ArticleAuthorSnapshotSchema.optional(),
  categories: z.array(TaxonomyTermSchema),
  tags: z.array(TaxonomyTermSchema),
  featuredImage: FeaturedImageSchema.optional(),
  content: SafeContentRepresentationSchema,
  seo: ContentSeoSchema,
});

export const CmsExportBundleSchema = z.object({
  generatedAt: z.string(),
  articles: z.array(ArticleSchema),
  authors: z.array(AuthorSchema).default([]),
});

export type TaxonomyTerm = z.infer<typeof TaxonomyTermSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type AuthorSocials = z.infer<typeof AuthorSocialsSchema>;
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
