import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { recoveredArticleToAdminArticle, listAdminArticles, type AdminArticle } from "@/lib/cms/admin-articles";
import {
  extractAffiliateLinksFromHtml,
  normalizeAffiliateUrl,
  type ParsedAffiliateLink,
} from "@/lib/cms/affiliate-parse";
import { getDb } from "@/lib/cms/db/client";
import {
  affiliateLinkArticles,
  affiliateLinks,
  type AffiliateLinkInsert,
  type AffiliateLinkRow,
} from "@/lib/cms/db/schema";
import { getRecoveredContentBundle } from "@/lib/content";

export type ScanOccurrence = {
  normalizedUrl: string;
  parsed: ParsedAffiliateLink;
  articleId: string;
  articleTitle: string;
  pathname: string;
  articleSource: "database" | "recovered" | "catalog";
};

export type AffiliateScanResult = {
  linksUpserted: number;
  occurrencesWritten: number;
  articlesScanned: number;
  catalogEntries: number;
};

type PrettyLinkEntry = { slug?: string; url?: string; name?: string };
type AawpProduct = { asin?: string; title?: string; url?: string };

function readDataJsonFile<T>(filename: string): T | null {
  // Keep the data/ segment static so Turbopack does not treat cwd+dynamic as the whole repo.
  const absolute = join(process.cwd(), "data", filename);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as T;
  } catch {
    return null;
  }
}

async function loadContentForAffiliateScan(): Promise<AdminArticle[]> {
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

function collectCatalogOccurrences(): ScanOccurrence[] {
  const occurrences: ScanOccurrence[] = [];

  const prettyLinks = readDataJsonFile<PrettyLinkEntry[]>("pretty-links.json") ?? [];
  for (const entry of prettyLinks) {
    if (!entry.url) continue;
    const parsed = normalizeAffiliateUrl(entry.url);
    if (!parsed) continue;
    occurrences.push({
      normalizedUrl: parsed.normalizedUrl,
      parsed: { ...parsed, anchorText: entry.name ?? null },
      articleId: `pretty-link:${entry.slug ?? parsed.normalizedUrl}`,
      articleTitle: entry.name ?? entry.slug ?? "Pretty Link",
      pathname: `/go/${entry.slug ?? ""}`,
      articleSource: "catalog",
    });
  }

  const aawpProducts = readDataJsonFile<AawpProduct[]>("aawp-products.json") ?? [];
  for (const product of aawpProducts) {
    if (!product.url) continue;
    const parsed = normalizeAffiliateUrl(product.url);
    if (!parsed) continue;
    occurrences.push({
      normalizedUrl: parsed.normalizedUrl,
      parsed: { ...parsed, anchorText: product.title ?? null },
      articleId: `aawp-product:${product.asin ?? parsed.normalizedUrl}`,
      articleTitle: product.title ?? product.asin ?? "AAWP product",
      pathname: "/catalog/aawp-products",
      articleSource: "catalog",
    });
  }

  return occurrences;
}

export function collectAffiliateOccurrences(articles: AdminArticle[]): ScanOccurrence[] {
  const occurrences: ScanOccurrence[] = [];

  for (const article of articles) {
    const links = extractAffiliateLinksFromHtml(article.html ?? "");
    for (const parsed of links) {
      occurrences.push({
        normalizedUrl: parsed.normalizedUrl,
        parsed,
        articleId: article.id,
        articleTitle: article.title,
        pathname: article.pathname,
        articleSource: article.source,
      });
    }
  }

  occurrences.push(...collectCatalogOccurrences());
  return occurrences;
}

function newAffiliateLinkId(): string {
  return `aff_${randomBytes(6).toString("hex")}`;
}

function mergeSource(
  existing: AffiliateLinkRow["source"] | undefined,
  incoming: "scanned" | "manual",
): AffiliateLinkRow["source"] {
  if (!existing) return incoming;
  if (existing === incoming) return existing;
  return "both";
}

export async function scanAndUpsertAffiliateLinks(): Promise<AffiliateScanResult> {
  const db = getDb();
  const articles = await loadContentForAffiliateScan();
  const occurrences = collectAffiliateOccurrences(articles);

  const byNormalized = new Map<string, { parsed: ParsedAffiliateLink; occurrences: ScanOccurrence[] }>();
  for (const occurrence of occurrences) {
    const bucket = byNormalized.get(occurrence.normalizedUrl);
    if (!bucket) {
      byNormalized.set(occurrence.normalizedUrl, {
        parsed: occurrence.parsed,
        occurrences: [occurrence],
      });
      continue;
    }
    bucket.occurrences.push(occurrence);
    if (!bucket.parsed.anchorText && occurrence.parsed.anchorText) {
      bucket.parsed = { ...bucket.parsed, anchorText: occurrence.parsed.anchorText };
    }
  }

  const existingRows = await db.select().from(affiliateLinks);
  const existingByNormalized = new Map(existingRows.map((row) => [row.normalizedUrl, row]));
  const existingByAsin = new Map<string, (typeof existingRows)[number]>();
  for (const row of existingRows) {
    if (row.network !== "amazon" || !row.asin) continue;
    const prior = existingByAsin.get(row.asin);
    // Prefer canonical keys without ?tag= when choosing which row to reuse.
    if (!prior || (prior.normalizedUrl.includes("tag=") && !row.normalizedUrl.includes("tag="))) {
      existingByAsin.set(row.asin, row);
    }
  }

  const linkIdByNormalized = new Map<string, string>();
  const activeLinkIds = new Set<string>();
  let linksUpserted = 0;

  for (const [normalizedUrl, { parsed }] of byNormalized) {
    const legacyTaggedKey = parsed.affiliateTag
      ? `${normalizedUrl}?tag=${parsed.affiliateTag}`
      : null;
    const existing =
      existingByNormalized.get(normalizedUrl) ??
      (legacyTaggedKey ? existingByNormalized.get(legacyTaggedKey) : undefined) ??
      (parsed.asin ? existingByAsin.get(parsed.asin) : undefined);
    const now = new Date();

    if (existing) {
      await db
        .update(affiliateLinks)
        .set({
          url: parsed.url,
          normalizedUrl,
          network: parsed.network,
          asin: parsed.asin,
          affiliateTag: parsed.affiliateTag,
          tagStatus: parsed.tagStatus,
          source: mergeSource(existing.source, "scanned"),
          label: existing.label ?? parsed.anchorText,
          updatedAt: now,
        })
        .where(eq(affiliateLinks.id, existing.id));
      linkIdByNormalized.set(normalizedUrl, existing.id);
      activeLinkIds.add(existing.id);
      existingByNormalized.set(normalizedUrl, existing);
      if (parsed.asin) existingByAsin.set(parsed.asin, existing);
      linksUpserted += 1;
      continue;
    }

    const id = newAffiliateLinkId();
    const values: AffiliateLinkInsert = {
      id,
      url: parsed.url,
      normalizedUrl,
      network: parsed.network,
      asin: parsed.asin,
      affiliateTag: parsed.affiliateTag,
      label: parsed.anchorText,
      notes: null,
      source: "scanned",
      tagStatus: parsed.tagStatus,
      liveStatus: "unchecked",
    };
    await db.insert(affiliateLinks).values(values);
    linkIdByNormalized.set(normalizedUrl, id);
    activeLinkIds.add(id);
    linksUpserted += 1;
  }

  // Remove scanned Amazon duplicates left behind by legacy ?tag= normalized keys.
  for (const row of existingRows) {
    if (activeLinkIds.has(row.id)) continue;
    if (row.source === "manual" || row.source === "both") continue;
    if (row.network !== "amazon" || !row.asin) continue;
    if (!existingByAsin.has(row.asin)) continue;
    const keeper = existingByAsin.get(row.asin);
    if (keeper && activeLinkIds.has(keeper.id) && keeper.id !== row.id) {
      await db.delete(affiliateLinks).where(eq(affiliateLinks.id, row.id));
    }
  }

  // Full rebuild of article/catalog occurrences from this scan.
  await db.delete(affiliateLinkArticles);

  const occurrenceRows: Array<typeof affiliateLinkArticles.$inferInsert> = [];
  const seenKeys = new Set<string>();

  for (const occurrence of occurrences) {
    const linkId = linkIdByNormalized.get(occurrence.normalizedUrl);
    if (!linkId) continue;
    const key = `${linkId}::${occurrence.articleId}::${occurrence.articleSource}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    occurrenceRows.push({
      linkId,
      articleId: occurrence.articleId,
      articleTitle: occurrence.articleTitle,
      pathname: occurrence.pathname,
      articleSource: occurrence.articleSource,
      anchorText: occurrence.parsed.anchorText,
    });
  }

  if (occurrenceRows.length > 0) {
    // Insert in chunks to avoid oversized statements
    const chunkSize = 200;
    for (let i = 0; i < occurrenceRows.length; i += chunkSize) {
      await db.insert(affiliateLinkArticles).values(occurrenceRows.slice(i, i + chunkSize));
    }
  }

  return {
    linksUpserted,
    occurrencesWritten: occurrenceRows.length,
    articlesScanned: articles.length,
    catalogEntries: occurrences.filter((item) => item.articleSource === "catalog").length,
  };
}
