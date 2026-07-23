import { put } from "@vercel/blob";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { listAdminMedia } from "@/lib/cms/admin-media";
import { getDb, isDatabaseConfigured } from "@/lib/cms/db/client";
import { mediaAssets } from "@/lib/cms/db/schema";
import { jsonError, jsonOk } from "@/lib/cms/http";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const source = searchParams.get("source");
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const inUseParam = searchParams.get("inUse");
  const inUse =
    inUseParam === "true" ? true : inUseParam === "false" ? false : undefined;

  const result = await listAdminMedia({
    search,
    source: source === "database" || source === "recovered" ? source : undefined,
    inUse,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Failed to load media.";
    return { error: message } as const;
  });

  if ("error" in result) {
    return jsonError(result.error, 500);
  }

  return jsonOk(result);
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const alt = String(formData.get("alt") ?? "").trim();

  if (!(file instanceof File)) {
    return jsonError("file is required.");
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return jsonError("Unsupported file type.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = sharp(buffer, { failOn: "warning" });
  const metadata = await image.metadata();
  const webp = await image.webp({ quality: 82 }).toBuffer();

  const year = new Date().getUTCFullYear();
  const month = String(new Date().getUTCMonth() + 1).padStart(2, "0");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/\.[^.]+$/, "");
  const pathname = `media/${year}/${month}/${safeName}.webp`;

  const blob = await put(pathname, webp, {
    access: "public",
    contentType: "image/webp",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const publicPath = `/${pathname}`;
  const db = getDb();
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      filename: `${safeName}.webp`,
      publicPath,
      blobUrl: blob.url,
      alt: alt || safeName,
      width: metadata.width ? String(metadata.width) : null,
      height: metadata.height ? String(metadata.height) : null,
      mimeType: "image/webp",
      createdBy: session.user?.email ?? "admin",
    })
    .returning();

  return jsonOk({ media: asset });
}
