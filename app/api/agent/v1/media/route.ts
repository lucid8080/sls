import { put } from "@vercel/blob";
import sharp from "sharp";
import { listAdminMedia } from "@/lib/cms/admin-media";
import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { getDb } from "@/lib/cms/db/client";
import { mediaAssets } from "@/lib/cms/db/schema";
import { agentJsonError, agentJsonOk } from "@/lib/cms/http";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:media");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const inUseParam = searchParams.get("inUse");
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  try {
    const result = await listAdminMedia({
      search: searchParams.get("search") ?? undefined,
      source: source === "database" || source === "recovered" ? source : undefined,
      inUse: inUseParam === "true" ? true : inUseParam === "false" ? false : undefined,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return agentJsonOk(result);
  } catch (error) {
    return agentJsonError(
      error instanceof Error ? error.message : "Failed to load media.",
      500,
    );
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:media");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const alt = String(formData.get("alt") ?? "").trim();

  if (!(file instanceof File)) {
    return agentJsonError("file is required.");
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return agentJsonError("Unsupported file type.");
  }

  if (file.name.includes("..") || /\.(php|js|html|svg)$/i.test(file.name)) {
    return agentJsonError("Rejected file name.");
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

  return agentJsonOk({
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
