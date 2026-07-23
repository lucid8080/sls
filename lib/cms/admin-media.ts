import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import { mediaAssets, type MediaRow } from "@/lib/cms/db/schema";
import { normalizeMediaPublicPath } from "@/lib/cms/media-paths";
import { getDeletedMediaPaths } from "@/lib/cms/media-tombstones";
import { getMediaUsage, getMediaUsageCounts, type MediaUsageEntry } from "@/lib/cms/media-usage";
import { getRecoveredMediaCatalog, type RecoveredMediaCatalogItem } from "@/lib/media";

export type AdminMedia = {
  id: string;
  filename: string;
  publicPath: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  mimeType: string;
  source: "database" | "recovered";
  createdAt: string | null;
  usageCount: number;
  inUse: boolean;
};

export type AdminMediaDetail = AdminMedia & {
  blobUrl: string | null;
  usages: MediaUsageEntry[];
};

export type AdminMediaFilters = {
  search?: string;
  source?: "database" | "recovered";
  inUse?: boolean;
  limit?: number;
  offset?: number;
};

export type AdminMediaListResult = {
  media: AdminMedia[];
  total: number;
  limit: number;
  offset: number;
};

const RECOVERED_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  pdf: "application/pdf",
};

function recoveredMimeType(mediaType: string): string {
  return RECOVERED_MIME[mediaType] ?? `image/${mediaType}`;
}

function sortKey(media: AdminMedia): string {
  return media.createdAt ?? media.publicPath;
}

export function recoveredMediaToAdminMedia(
  item: RecoveredMediaCatalogItem,
  usageCount = 0,
): AdminMedia {
  const filename = item.publicPath.split("/").pop() ?? item.publicPath;

  return {
    id: `recovered:${normalizeMediaPublicPath(item.publicPath)}`,
    filename,
    publicPath: item.publicPath,
    alt: null,
    width: item.width != null ? String(item.width) : null,
    height: item.height != null ? String(item.height) : null,
    mimeType: recoveredMimeType(item.mediaType),
    source: "recovered",
    createdAt: null,
    usageCount,
    inUse: usageCount > 0,
  };
}

export function databaseMediaToAdminMedia(row: MediaRow, usageCount = 0): AdminMedia {
  return {
    id: row.id,
    filename: row.filename,
    publicPath: row.publicPath,
    alt: row.alt,
    width: row.width,
    height: row.height,
    mimeType: row.mimeType,
    source: "database",
    createdAt: row.createdAt.toISOString(),
    usageCount,
    inUse: usageCount > 0,
  };
}

export function combineAdminMedia(
  databaseMedia: AdminMedia[],
  recoveredMedia: RecoveredMediaCatalogItem[],
  usageCounts: Map<string, number>,
  filters: Omit<AdminMediaFilters, "limit" | "offset"> = {},
): AdminMedia[] {
  const byPath = new Map<string, AdminMedia>();

  for (const item of recoveredMedia) {
    const usageCount = usageCounts.get(normalizeMediaPublicPath(item.publicPath)) ?? 0;
    const adminMedia = recoveredMediaToAdminMedia(item, usageCount);
    byPath.set(normalizeMediaPublicPath(adminMedia.publicPath), adminMedia);
  }
  for (const item of databaseMedia) {
    byPath.set(normalizeMediaPublicPath(item.publicPath), item);
  }

  const search = filters.search?.trim().toLowerCase();

  return [...byPath.values()]
    .filter((item) => !filters.source || item.source === filters.source)
    .filter((item) => filters.inUse === undefined || item.inUse === filters.inUse)
    .filter(
      (item) =>
        !search ||
        item.filename.toLowerCase().includes(search) ||
        item.publicPath.toLowerCase().includes(search) ||
        (item.alt?.toLowerCase().includes(search) ?? false),
    )
    .sort((left, right) => sortKey(right).localeCompare(sortKey(left)));
}

async function getActiveRecoveredMediaCatalog(): Promise<RecoveredMediaCatalogItem[]> {
  const deleted = await getDeletedMediaPaths();
  return getRecoveredMediaCatalog().filter(
    (item) => !deleted.has(normalizeMediaPublicPath(item.publicPath)),
  );
}

export async function listAdminMedia(filters: AdminMediaFilters = {}): Promise<AdminMediaListResult> {
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const offset = Math.max(0, filters.offset ?? 0);
  const deleted = await getDeletedMediaPaths();

  const [rows, recovered, usageCounts] = await Promise.all([
    getDb().select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt)),
    getActiveRecoveredMediaCatalog(),
    getMediaUsageCounts(),
  ]);

  const databaseMedia = rows
    .filter((row) => !deleted.has(normalizeMediaPublicPath(row.publicPath)))
    .map((row) => databaseMediaToAdminMedia(row, usageCounts.get(normalizeMediaPublicPath(row.publicPath)) ?? 0));

  const combined = combineAdminMedia(databaseMedia, recovered, usageCounts, filters);

  return {
    media: combined.slice(offset, offset + limit),
    total: combined.length,
    limit,
    offset,
  };
}

export async function getAdminMediaById(id: string): Promise<AdminMediaDetail | undefined> {
  const deleted = await getDeletedMediaPaths();
  const usageCounts = await getMediaUsageCounts();

  if (!id.startsWith("recovered:")) {
    const [row] = await getDb().select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!row || deleted.has(normalizeMediaPublicPath(row.publicPath))) {
      return undefined;
    }

    const usages = await getMediaUsage(row.publicPath);
    const media = databaseMediaToAdminMedia(row, usages.length);
    return {
      ...media,
      blobUrl: row.blobUrl,
      usages,
    };
  }

  const publicPath = id.slice("recovered:".length);
  if (deleted.has(normalizeMediaPublicPath(publicPath))) {
    return undefined;
  }

  const recovered = getRecoveredMediaCatalog().find(
    (item) => normalizeMediaPublicPath(item.publicPath) === normalizeMediaPublicPath(publicPath),
  );
  if (!recovered) {
    return undefined;
  }

  const usages = await getMediaUsage(recovered.publicPath);
  const usageCount = usageCounts.get(normalizeMediaPublicPath(recovered.publicPath)) ?? usages.length;

  return {
    ...recoveredMediaToAdminMedia(recovered, usageCount),
    blobUrl: null,
    usages,
  };
}

export async function updateAdminMediaAlt(id: string, alt: string): Promise<AdminMediaDetail | undefined> {
  if (id.startsWith("recovered:")) {
    return undefined;
  }

  const [updated] = await getDb()
    .update(mediaAssets)
    .set({ alt: alt.trim() || null })
    .where(eq(mediaAssets.id, id))
    .returning();

  if (!updated) {
    return undefined;
  }

  return getAdminMediaById(updated.id);
}
