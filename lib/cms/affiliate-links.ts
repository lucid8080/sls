import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { normalizeAffiliateUrl } from "@/lib/cms/affiliate-parse";
import { checkAffiliateUrls, type AffiliateCheckResult } from "@/lib/cms/affiliate-check";
import { getDb } from "@/lib/cms/db/client";
import {
  affiliateLinkArticles,
  affiliateLinks,
  type AffiliateLinkArticleRow,
  type AffiliateLinkInsert,
  type AffiliateLinkRow,
} from "@/lib/cms/db/schema";

export type AffiliateLinkFilters = {
  network?: "amazon" | "other";
  tagStatus?: "ok" | "missing_tag" | "not_applicable";
  liveStatus?: AffiliateLinkRow["liveStatus"];
  search?: string;
};

export type AffiliateLinkArticleSummary = {
  articleId: string;
  articleTitle: string;
  pathname: string;
  articleSource: AffiliateLinkArticleRow["articleSource"];
  anchorText: string | null;
};

export type SerializedAffiliateLink = {
  id: string;
  url: string;
  normalizedUrl: string;
  network: AffiliateLinkRow["network"];
  asin: string | null;
  affiliateTag: string | null;
  label: string | null;
  notes: string | null;
  source: AffiliateLinkRow["source"];
  tagStatus: AffiliateLinkRow["tagStatus"];
  liveStatus: AffiliateLinkRow["liveStatus"];
  liveStatusCode: number | null;
  liveFinalUrl: string | null;
  liveCheckedAt: string | null;
  liveError: string | null;
  createdAt: string;
  updatedAt: string;
  articles: AffiliateLinkArticleSummary[];
};

export type CreateAffiliateLinkInput = {
  url: string;
  label?: string | null;
  notes?: string | null;
};

export type UpdateAffiliateLinkInput = {
  label?: string | null;
  notes?: string | null;
  url?: string;
};

function newId(): string {
  return `aff_${randomBytes(6).toString("hex")}`;
}

export function serializeAffiliateLink(
  row: AffiliateLinkRow,
  articles: AffiliateLinkArticleSummary[] = [],
): SerializedAffiliateLink {
  return {
    id: row.id,
    url: row.url,
    normalizedUrl: row.normalizedUrl,
    network: row.network,
    asin: row.asin,
    affiliateTag: row.affiliateTag,
    label: row.label,
    notes: row.notes,
    source: row.source,
    tagStatus: row.tagStatus,
    liveStatus: row.liveStatus,
    liveStatusCode: row.liveStatusCode,
    liveFinalUrl: row.liveFinalUrl,
    liveCheckedAt: row.liveCheckedAt?.toISOString() ?? null,
    liveError: row.liveError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    articles,
  };
}

async function loadArticlesForLinks(
  linkIds: string[],
): Promise<Map<string, AffiliateLinkArticleSummary[]>> {
  const map = new Map<string, AffiliateLinkArticleSummary[]>();
  if (linkIds.length === 0) return map;

  const db = getDb();
  const rows = await db
    .select()
    .from(affiliateLinkArticles)
    .where(inArray(affiliateLinkArticles.linkId, linkIds))
    .orderBy(asc(affiliateLinkArticles.articleTitle));

  for (const row of rows) {
    const list = map.get(row.linkId) ?? [];
    list.push({
      articleId: row.articleId,
      articleTitle: row.articleTitle,
      pathname: row.pathname,
      articleSource: row.articleSource,
      anchorText: row.anchorText,
    });
    map.set(row.linkId, list);
  }
  return map;
}

export async function listAffiliateLinks(
  filters: AffiliateLinkFilters = {},
): Promise<SerializedAffiliateLink[]> {
  const db = getDb();
  const conditions = [];

  if (filters.network) {
    conditions.push(eq(affiliateLinks.network, filters.network));
  }
  if (filters.tagStatus) {
    conditions.push(eq(affiliateLinks.tagStatus, filters.tagStatus));
  }
  if (filters.liveStatus) {
    conditions.push(eq(affiliateLinks.liveStatus, filters.liveStatus));
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(affiliateLinks.url, q),
        ilike(affiliateLinks.normalizedUrl, q),
        ilike(affiliateLinks.label, q),
        ilike(affiliateLinks.asin, q),
        ilike(affiliateLinks.notes, q),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(affiliateLinks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(affiliateLinks.updatedAt));

  const articlesByLink = await loadArticlesForLinks(rows.map((row) => row.id));
  return rows.map((row) => serializeAffiliateLink(row, articlesByLink.get(row.id) ?? []));
}

export async function getAffiliateLinkById(id: string): Promise<SerializedAffiliateLink | null> {
  const db = getDb();
  const [row] = await db.select().from(affiliateLinks).where(eq(affiliateLinks.id, id)).limit(1);
  if (!row) return null;
  const articlesByLink = await loadArticlesForLinks([id]);
  return serializeAffiliateLink(row, articlesByLink.get(id) ?? []);
}

export async function createManualAffiliateLink(
  input: CreateAffiliateLinkInput,
): Promise<SerializedAffiliateLink> {
  const parsed = normalizeAffiliateUrl(input.url);
  if (!parsed) {
    throw new Error("URL must be an Amazon or recognized affiliate link.");
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(affiliateLinks)
    .where(eq(affiliateLinks.normalizedUrl, parsed.normalizedUrl))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(affiliateLinks)
      .set({
        url: parsed.url,
        network: parsed.network,
        asin: parsed.asin,
        affiliateTag: parsed.affiliateTag,
        tagStatus: parsed.tagStatus,
        label: input.label?.trim() || existing.label || null,
        notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
        source: existing.source === "scanned" ? "both" : existing.source === "manual" ? "manual" : "both",
        updatedAt: new Date(),
      })
      .where(eq(affiliateLinks.id, existing.id))
      .returning();
    const articlesByLink = await loadArticlesForLinks([row.id]);
    return serializeAffiliateLink(row, articlesByLink.get(row.id) ?? []);
  }

  const values: AffiliateLinkInsert = {
    id: newId(),
    url: parsed.url,
    normalizedUrl: parsed.normalizedUrl,
    network: parsed.network,
    asin: parsed.asin,
    affiliateTag: parsed.affiliateTag,
    label: input.label?.trim() || null,
    notes: input.notes?.trim() || null,
    source: "manual",
    tagStatus: parsed.tagStatus,
    liveStatus: "unchecked",
  };

  const [row] = await db.insert(affiliateLinks).values(values).returning();
  return serializeAffiliateLink(row, []);
}

export async function updateAffiliateLink(
  id: string,
  input: UpdateAffiliateLinkInput,
): Promise<SerializedAffiliateLink> {
  const db = getDb();
  const [existing] = await db.select().from(affiliateLinks).where(eq(affiliateLinks.id, id)).limit(1);
  if (!existing) {
    throw new Error("Affiliate link not found.");
  }

  let nextUrl = existing.url;
  let nextNormalized = existing.normalizedUrl;
  let nextNetwork = existing.network;
  let nextAsin = existing.asin;
  let nextTag = existing.affiliateTag;
  let nextTagStatus = existing.tagStatus;

  if (input.url !== undefined) {
    const parsed = normalizeAffiliateUrl(input.url);
    if (!parsed) {
      throw new Error("URL must be an Amazon or recognized affiliate link.");
    }
    nextUrl = parsed.url;
    nextNormalized = parsed.normalizedUrl;
    nextNetwork = parsed.network;
    nextAsin = parsed.asin;
    nextTag = parsed.affiliateTag;
    nextTagStatus = parsed.tagStatus;
  }

  const [row] = await db
    .update(affiliateLinks)
    .set({
      url: nextUrl,
      normalizedUrl: nextNormalized,
      network: nextNetwork,
      asin: nextAsin,
      affiliateTag: nextTag,
      tagStatus: nextTagStatus,
      label: input.label !== undefined ? input.label?.trim() || null : existing.label,
      notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(affiliateLinks.id, id))
    .returning();

  const articlesByLink = await loadArticlesForLinks([id]);
  return serializeAffiliateLink(row, articlesByLink.get(id) ?? []);
}

export async function deleteAffiliateLink(id: string): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(affiliateLinks).where(eq(affiliateLinks.id, id)).limit(1);
  if (!existing) {
    throw new Error("Affiliate link not found.");
  }

  // Manual-only links can be fully deleted; scanned links remove the row too (occurrences cascade).
  await db.delete(affiliateLinks).where(eq(affiliateLinks.id, id));
}

function applyCheckResult(
  result: AffiliateCheckResult,
): Pick<
  AffiliateLinkInsert,
  "liveStatus" | "liveStatusCode" | "liveFinalUrl" | "liveCheckedAt" | "liveError" | "updatedAt"
> {
  return {
    liveStatus: result.liveStatus,
    liveStatusCode: result.liveStatusCode,
    liveFinalUrl: result.liveFinalUrl,
    liveCheckedAt: new Date(),
    liveError: result.liveError,
    updatedAt: new Date(),
  };
}

export async function checkAffiliateLinks(ids?: string[]): Promise<SerializedAffiliateLink[]> {
  const db = getDb();

  const toCheck =
    ids && ids.length > 0
      ? await db.select().from(affiliateLinks).where(inArray(affiliateLinks.id, ids))
      : await db
          .select()
          .from(affiliateLinks)
          .where(eq(affiliateLinks.liveStatus, "unchecked"))
          .orderBy(asc(affiliateLinks.updatedAt))
          .limit(100);

  // If nothing unchecked and no ids specified, check the 50 least-recently-checked links.
  const targets =
    toCheck.length > 0 || (ids && ids.length > 0)
      ? toCheck
      : await db
          .select()
          .from(affiliateLinks)
          .orderBy(sql`${affiliateLinks.liveCheckedAt} ASC NULLS FIRST`)
          .limit(50);

  if (targets.length === 0) {
    return [];
  }

  await checkAffiliateUrls(
    targets.map((row) => ({ id: row.id, url: row.url })),
    {
      concurrency: 3,
      onResult: async (id, result) => {
        await db.update(affiliateLinks).set(applyCheckResult(result)).where(eq(affiliateLinks.id, id));
      },
    },
  );

  const updated = await db
    .select()
    .from(affiliateLinks)
    .where(inArray(affiliateLinks.id, targets.map((row) => row.id)));
  const articlesByLink = await loadArticlesForLinks(updated.map((row) => row.id));
  return updated.map((row) => serializeAffiliateLink(row, articlesByLink.get(row.id) ?? []));
}

export async function countAffiliateLinks(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(affiliateLinks);
  return row?.count ?? 0;
}
