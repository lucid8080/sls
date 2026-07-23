import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureRecoveredArticleOverride,
  listAdminArticles,
  recoveredArticleToAdminArticle,
  type AdminArticle,
} from "@/lib/cms/admin-articles";
import {
  affiliateUrlMatchesAmazonTarget,
  ensureAmazonAffiliateTag,
  rewriteAmazonAffiliateTagsInHtml,
} from "@/lib/cms/affiliate-parse";
import { scanAndUpsertAffiliateLinks, type AffiliateScanResult } from "@/lib/cms/affiliate-scan";
import { getAffiliateLinkById } from "@/lib/cms/affiliate-links";
import { updateArticle } from "@/lib/cms/articles";
import { exportCmsBundle } from "@/lib/cms/export";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { getRecoveredContentBundle } from "@/lib/content";

const SAMPLE_LIMIT = 20;

export type AffiliateTagFixSample = {
  articleId: string;
  title: string;
  before: string;
  after: string;
};

export type AffiliateTagFixResult = {
  dryRun: boolean;
  linkId: string | null;
  articlesExamined: number;
  articlesUpdated: number;
  linksRewritten: number;
  catalogUpdated: number;
  skippedShortLinks: number;
  samples: AffiliateTagFixSample[];
  scan?: AffiliateScanResult;
  exportCount?: number;
};

type PrettyLinkEntry = { slug?: string; url?: string; name?: string };
type AawpProduct = { asin?: string; title?: string; url?: string };

type AmazonTarget = {
  asin: string | null;
  normalizedUrl: string;
  url: string;
};

async function loadContentForFix(): Promise<AdminArticle[]> {
  const articles = await listAdminArticles();
  const pages = getRecoveredContentBundle().pages.map((page) => recoveredArticleToAdminArticle(page));
  const byId = new Map<string, AdminArticle>();
  for (const page of pages) {
    byId.set(page.id, page);
  }
  for (const article of articles) {
    byId.set(article.id, article);
  }
  return [...byId.values()];
}

function firstRewrittenPair(beforeHtml: string, afterHtml: string): { before: string; after: string } | null {
  const hrefRe = /href=["']([^"']+)["']/gi;
  const beforeHrefs = [...beforeHtml.matchAll(hrefRe)].map((match) => match[1]);
  const afterHrefs = [...afterHtml.matchAll(hrefRe)].map((match) => match[1]);
  for (let i = 0; i < beforeHrefs.length; i += 1) {
    if (beforeHrefs[i] !== afterHrefs[i]) {
      return { before: beforeHrefs[i], after: afterHrefs[i] ?? beforeHrefs[i] };
    }
  }
  return null;
}

function rewriteCatalogFile(
  relativePath: string,
  dryRun: boolean,
  target?: AmazonTarget | null,
): { updated: number; skippedShortLinks: number } {
  const absolute = join(process.cwd(), relativePath);
  if (!existsSync(absolute)) {
    return { updated: 0, skippedShortLinks: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolute, "utf8"));
  } catch {
    return { updated: 0, skippedShortLinks: 0 };
  }

  if (!Array.isArray(parsed)) {
    return { updated: 0, skippedShortLinks: 0 };
  }

  let updated = 0;
  let skippedShortLinks = 0;
  let dirty = false;

  const next = parsed.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const record = entry as PrettyLinkEntry & AawpProduct;
    if (!record.url || typeof record.url !== "string") return entry;

    if (target && !affiliateUrlMatchesAmazonTarget(record.url, target)) {
      return entry;
    }

    const result = ensureAmazonAffiliateTag(record.url);
    if (result.status === "skipped_short_link") {
      skippedShortLinks += 1;
      return entry;
    }
    if (result.status !== "rewritten") {
      return entry;
    }

    updated += 1;
    dirty = true;
    return { ...record, url: result.url };
  });

  if (dirty && !dryRun) {
    writeFileSync(absolute, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  return { updated, skippedShortLinks };
}

export async function fixAmazonAffiliateTags(options: {
  dryRun?: boolean;
  actor?: string;
  /** When set, only fix this tracked affiliate link (and matching URLs). */
  linkId?: string;
} = {}): Promise<AffiliateTagFixResult> {
  const dryRun = Boolean(options.dryRun);
  const actor = options.actor ?? "admin";
  const linkId = options.linkId?.trim() || null;

  let target: AmazonTarget | null = null;
  let allowedArticleIds: Set<string> | null = null;

  if (linkId) {
    const link = await getAffiliateLinkById(linkId);
    if (!link) {
      throw new Error("Affiliate link not found.");
    }
    if (link.network !== "amazon") {
      throw new Error("Tag fix only applies to Amazon links.");
    }
    target = {
      asin: link.asin,
      normalizedUrl: link.normalizedUrl,
      url: link.url,
    };
    allowedArticleIds = new Set(
      link.articles
        .filter((article) => article.articleSource === "database" || article.articleSource === "recovered")
        .map((article) => article.articleId),
    );
  }

  const allArticles = await loadContentForFix();
  // Single-link rows can be orphaned (zero affiliate_link_articles) after a rescan.
  // Fall back to searching content that contains the ASIN/URL instead of trusting associations alone.
  let articles =
    allowedArticleIds != null && allowedArticleIds.size > 0
      ? (() => {
          const preferred = allArticles.filter((article) => allowedArticleIds!.has(article.id));
          return preferred.length > 0 ? preferred : allArticles;
        })()
      : allArticles;

  if (linkId && target?.asin && (allowedArticleIds?.size ?? 0) === 0) {
    const asinUpper = target.asin.toUpperCase();
    articles = allArticles.filter((article) => (article.html ?? "").toUpperCase().includes(asinUpper));
  }

  let articlesUpdated = 0;
  let linksRewritten = 0;
  let skippedShortLinks = 0;
  const samples: AffiliateTagFixSample[] = [];

  const shouldRewrite = target
    ? (href: string) => affiliateUrlMatchesAmazonTarget(href, target!)
    : undefined;

  for (const article of articles) {
    const rewrite = rewriteAmazonAffiliateTagsInHtml(article.html ?? "", undefined, shouldRewrite);
    skippedShortLinks += rewrite.skippedShortLinks;
    if (rewrite.changedCount === 0) {
      continue;
    }

    linksRewritten += rewrite.changedCount;

    if (samples.length < SAMPLE_LIMIT) {
      const pair = firstRewrittenPair(article.html ?? "", rewrite.html);
      if (pair) {
        samples.push({
          articleId: article.id,
          title: article.title,
          before: pair.before,
          after: pair.after,
        });
      }
    }

    if (dryRun) {
      articlesUpdated += 1;
      continue;
    }

    if (article.source === "recovered") {
      const ensured = await ensureRecoveredArticleOverride(article.id, actor);
      if (!ensured) {
        continue;
      }
    }

    const sanitized = sanitizeCmsHtml(rewrite.html, {
      id: article.id,
      title: article.title,
      pathname: article.pathname,
    });

    await updateArticle(article.id, { html: sanitized.html }, actor);
    articlesUpdated += 1;
  }

  // Single-link: still check catalog for matching URLs. Bulk: rewrite all catalog Amazon URLs.
  const pretty = rewriteCatalogFile("data/pretty-links.json", dryRun, target);
  const aawp = rewriteCatalogFile("data/aawp-products.json", dryRun, target);
  const catalogUpdated = pretty.updated + aawp.updated;
  skippedShortLinks += pretty.skippedShortLinks + aawp.skippedShortLinks;

  const result: AffiliateTagFixResult = {
    dryRun,
    linkId,
    articlesExamined: articles.length,
    articlesUpdated,
    linksRewritten,
    catalogUpdated,
    skippedShortLinks,
    samples,
  };

  if (!dryRun && (articlesUpdated > 0 || catalogUpdated > 0)) {
    const exported = await exportCmsBundle();
    result.exportCount = exported.count;
    result.scan = await scanAndUpsertAffiliateLinks();
  }

  return result;
}
