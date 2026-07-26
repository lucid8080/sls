import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/lib/cms/db/client";
import { mediaAssets } from "@/lib/cms/db/schema";
import { normalizeMediaPublicPath } from "@/lib/cms/media-paths";
import { getDeletedMediaPaths } from "@/lib/cms/media-tombstones";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Serve CMS-uploaded media that lives in Vercel Blob but is referenced as
 * `/media/YYYY/MM/…`. Static files under `public/media` still take precedence
 * for recovered assets that exist on disk.
 */
export async function GET(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return new NextResponse("Media storage is not configured.", { status: 503 });
  }

  const { path } = await context.params;
  if (!path?.length) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const publicPath = `/${["media", ...path].join("/")}`.replace(/\/{2,}/g, "/");

  try {
    const deleted = await getDeletedMediaPaths();
    if (deleted.has(normalizeMediaPublicPath(publicPath))) {
      return new NextResponse("Not found.", { status: 404 });
    }

    const [row] = await getDb()
      .select({ blobUrl: mediaAssets.blobUrl })
      .from(mediaAssets)
      .where(eq(mediaAssets.publicPath, publicPath))
      .limit(1);

    if (!row?.blobUrl) {
      return new NextResponse("Not found.", { status: 404 });
    }

    return NextResponse.redirect(row.blobUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media lookup failed.";
    console.error(`[media] Failed to resolve ${publicPath}: ${message}`);
    return new NextResponse(`Media lookup failed: ${message}`, { status: 500 });
  }
}
