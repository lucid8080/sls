import { put } from "@vercel/blob";
import sharp from "sharp";
import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { getDb } from "@/lib/cms/db/client";
import { mediaAssets } from "@/lib/cms/db/schema";
import { jsonError, jsonOk } from "@/lib/cms/http";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:write");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
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

  if (file.name.includes("..") || /\.(php|js|html|svg)$/i.test(file.name)) {
    return jsonError("Rejected file name.");
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
      createdBy: `agent:${authResult.label}`,
    })
    .returning();

  return jsonOk({
    media: {
      id: asset.id,
      publicPath,
      url: blob.url,
      alt: asset.alt,
      width: asset.width,
      height: asset.height,
    },
  });
}
