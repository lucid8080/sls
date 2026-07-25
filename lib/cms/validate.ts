import { ArticleSchema, BLOCKED_PUBLIC_RE, CORE_CATEGORY_SLUGS, hasPublicCategory, type ArticleExport } from "@/lib/cms/schemas";
import type { ArticleRow } from "@/lib/cms/db/schema";
import { getContentBundle } from "@/lib/content";
import { normalizeFeaturedImage } from "@/lib/cms/featured-image";

export type QualityGateIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type QualityGateResult = {
  passed: boolean;
  issues: QualityGateIssue[];
};

export type ValidationResult = {
  ok: boolean;
  article?: ArticleExport;
  issues: QualityGateIssue[];
};

const DEFAULT_GATES = {
  minInternalLinks: 3,
  maxInternalLinks: 12,
  requireFaq: true,
  requireH2: true,
};

export function articleRowToExport(row: ArticleRow): ArticleExport {
  return {
    id: row.id,
    type: "article",
    title: row.title,
    slug: row.slug,
    pathname: row.pathname,
    status: "published",
    excerpt: row.excerpt ?? undefined,
    publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
    modifiedAt: row.modifiedAt?.toISOString(),
    author: row.author ?? undefined,
    categories: row.categories ?? [],
    tags: row.tags ?? [],
    featuredImage: normalizeFeaturedImage(row.featuredImage),
    content: {
      kind: "html",
      html: row.html,
    },
    seo: row.seo,
  };
}

export function runQualityGates(
  article: ArticleExport,
  options: Partial<typeof DEFAULT_GATES> = {},
): QualityGateResult {
  const gates = { ...DEFAULT_GATES, ...options };
  const issues: QualityGateIssue[] = [];
  const html = article.content.html;

  if (gates.requireH2 && !/<h2[\s>]/i.test(html)) {
    issues.push({
      code: "require_h2",
      message: "Article must include at least one H2 heading.",
      severity: "error",
    });
  }

  if (gates.requireFaq && !/frequently asked questions|faq/i.test(html)) {
    issues.push({
      code: "require_faq",
      message: "Article should include a FAQ section.",
      severity: "warning",
    });
  }

  const internalLinks = [...html.matchAll(/href="(\/[^"]*)"/gi)].map((match) => match[1]);
  if (internalLinks.length < gates.minInternalLinks) {
    issues.push({
      code: "min_internal_links",
      message: `Article has ${internalLinks.length} internal links; target is ${gates.minInternalLinks}-${gates.maxInternalLinks}.`,
      severity: "warning",
    });
  }

  const publicText = [article.title, article.slug, article.pathname, article.excerpt].join(" ");
  if (BLOCKED_PUBLIC_RE.test(publicText) || BLOCKED_PUBLIC_RE.test(html)) {
    issues.push({
      code: "blocked_spam_pattern",
      message: "Content matches blocked casino/gambling spam patterns.",
      severity: "error",
    });
  }

  if (!hasPublicCategory(article.categories)) {
    const allowed = [...CORE_CATEGORY_SLUGS].sort().join(", ");
    issues.push({
      code: "public_category_required",
      message: `Article needs at least one public category so it can appear on the site. Allowed: ${allowed}.`,
      severity: "error",
    });
  }

  const knownPaths = new Set(
    getContentBundle().allPublicItems.map((item) => item.pathname.replace(/\/$/, "").toLowerCase()),
  );
  knownPaths.add(article.pathname.replace(/\/$/, "").toLowerCase());

  for (const href of internalLinks) {
    const normalized = href.replace(/\/$/, "").toLowerCase();
    if (normalized && !knownPaths.has(normalized) && !normalized.startsWith("/media/")) {
      issues.push({
        code: "broken_internal_link",
        message: `Unresolved internal link: ${href}`,
        severity: "warning",
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  return { passed: errors.length === 0, issues };
}

export function validatePublishedArticle(article: ArticleExport): ValidationResult {
  const parsed = ArticleSchema.safeParse(article);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "schema_validation",
        message: `${issue.path.join(".") || "article"}: ${issue.message}`,
        severity: "error" as const,
      })),
    };
  }

  const gates = runQualityGates(parsed.data);
  return {
    ok: gates.passed,
    article: parsed.data,
    issues: gates.issues,
  };
}
