import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/lib/cms/db/client";
import { mediaAssets } from "@/lib/cms/db/schema";
import { getAdminMediaById, type AdminMedia } from "@/lib/cms/admin-media";
import { normalizeMediaPublicPath } from "@/lib/cms/media-paths";
import { getMediaUsage, invalidateMediaUsageIndex, type MediaUsageEntry } from "@/lib/cms/media-usage";
import { getDeletedMediaPaths, recordMediaDeletion } from "@/lib/cms/media-tombstones";

export type DeleteMediaResult =
  | { ok: true }
  | { ok: false; status: 409; usages: MediaUsageEntry[] }
  | { ok: false; status: 404; message: string };

function resolveMediaAcceptedPath(): string | null {
  const candidates = [
    join(process.cwd(), "data", "media-accepted.json"),
    join(process.cwd(), "recovered-media-output", "reports", "media-accepted.json"),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function removeFromMediaAcceptedManifest(publicPath: string): void {
  const manifestPath = resolveMediaAcceptedPath();
  if (!manifestPath) {
    return;
  }

  const normalizedTarget = normalizeMediaPublicPath(publicPath);
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Array<{
    originalPath: string;
    outputPath?: string;
  }>;

  const filtered = parsed.filter((item) => {
    if (!item.outputPath) {
      return true;
    }
    const itemPath = normalizeMediaPublicPath(`/${item.outputPath.replace(/\\/g, "/")}`);
    return itemPath !== normalizedTarget;
  });

  if (filtered.length !== parsed.length) {
    writeFileSync(manifestPath, `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
  }
}

function deleteLocalPublicFile(publicPath: string): void {
  const relative = publicPath.replace(/^\/+/, "");
  const absolute = join(process.cwd(), "public", relative);
  if (existsSync(absolute)) {
    unlinkSync(absolute);
  }
}

export async function deleteAdminMedia(id: string, actor: string): Promise<DeleteMediaResult> {
  const media = await getAdminMediaById(id);
  if (!media) {
    return { ok: false, status: 404, message: "Media not found." };
  }

  const deletedPaths = await getDeletedMediaPaths();
  if (deletedPaths.has(normalizeMediaPublicPath(media.publicPath))) {
    return { ok: false, status: 404, message: "Media not found." };
  }

  const usages = await getMediaUsage(media.publicPath);
  if (usages.length > 0) {
    return { ok: false, status: 409, usages };
  }

  if (media.source === "database") {
    const db = getDb();
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, media.id)).limit(1);
    if (row?.blobUrl) {
      await del(row.blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }
    await db.delete(mediaAssets).where(eq(mediaAssets.id, media.id));
  }

  await recordMediaDeletion(media.publicPath, actor);
  deleteLocalPublicFile(media.publicPath);
  removeFromMediaAcceptedManifest(media.publicPath);
  invalidateMediaUsageIndex();

  return { ok: true };
}

export type BulkDeleteMediaResult = {
  deleted: string[];
  blocked: Array<{ id: string; usages: MediaUsageEntry[] }>;
  notFound: string[];
};

export const BULK_DELETE_MEDIA_MAX_IDS = 50;

export async function bulkDeleteAdminMedia(
  ids: string[],
  actor: string,
  deleteOne: (id: string, actor: string) => Promise<DeleteMediaResult> = deleteAdminMedia,
): Promise<BulkDeleteMediaResult> {
  const deleted: string[] = [];
  const blocked: Array<{ id: string; usages: MediaUsageEntry[] }> = [];
  const notFound: string[] = [];

  for (const id of ids) {
    const result = await deleteOne(id, actor);
    if (result.ok) {
      deleted.push(id);
      continue;
    }
    if (result.status === 409) {
      blocked.push({ id, usages: result.usages });
      continue;
    }
    notFound.push(id);
  }

  return { deleted, blocked, notFound };
}

export function assertDeletable(media: AdminMedia, usages: MediaUsageEntry[]): DeleteMediaResult | null {
  if (usages.length > 0) {
    return { ok: false, status: 409, usages };
  }
  return null;
}
