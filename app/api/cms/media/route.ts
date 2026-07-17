import { desc } from "drizzle-orm";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/cms/db/client";
import { mediaAssets } from "@/lib/cms/db/schema";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk } from "@/lib/cms/http";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const db = getDb();
  const media = await db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt));
  return jsonOk({ media });
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
