import { getDb } from "@/lib/cms/db/client";
import { mediaDeletions } from "@/lib/cms/db/schema";
import { normalizeMediaPublicPath } from "@/lib/cms/media-paths";

let cachedDeletedPaths: Set<string> | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

function isMissingRelationError(error: unknown): boolean {
  return error instanceof Error && /relation ".+" does not exist/i.test(error.message);
}

export async function getDeletedMediaPaths(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedDeletedPaths && now - cachedAt < CACHE_MS) {
    return cachedDeletedPaths;
  }

  try {
    const rows = await getDb().select({ publicPath: mediaDeletions.publicPath }).from(mediaDeletions);
    cachedDeletedPaths = new Set(rows.map((row) => normalizeMediaPublicPath(row.publicPath)));
    cachedAt = now;
    return cachedDeletedPaths;
  } catch (error) {
    if (isMissingRelationError(error)) {
      cachedDeletedPaths = new Set();
      cachedAt = now;
      return cachedDeletedPaths;
    }
    throw error;
  }
}

export function invalidateDeletedMediaCache(): void {
  cachedDeletedPaths = null;
  cachedAt = 0;
}

export async function recordMediaDeletion(publicPath: string, deletedBy: string): Promise<void> {
  await getDb()
    .insert(mediaDeletions)
    .values({
      publicPath,
      deletedBy,
    })
    .onConflictDoNothing();
  invalidateDeletedMediaCache();
}
