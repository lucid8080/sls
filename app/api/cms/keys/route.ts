import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { generateApiKey } from "@/lib/cms/agent-auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { apiKeys } from "@/lib/cms/db/schema";
import { getDb } from "@/lib/cms/db/client";
import { jsonError, jsonOk } from "@/lib/cms/http";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const db = getDb();
  const keys = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  return jsonOk({
    keys: keys.map((key) => ({
      id: key.id,
      label: key.label,
      prefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const body = (await request.json()) as { label?: string; scopes?: string[] };
  if (!body.label?.trim()) {
    return jsonError("label is required.");
  }

  const generated = generateApiKey();
  const db = getDb();
  const [row] = await db
    .insert(apiKeys)
    .values({
      label: body.label.trim(),
      keyHash: generated.hash,
      keyPrefix: generated.prefix,
      scopes: body.scopes ?? ["agent:read", "agent:write", "agent:calendar"],
    })
    .returning();

  return jsonOk({
    id: row.id,
    label: row.label,
    prefix: row.keyPrefix,
    scopes: row.scopes,
    key: generated.key,
  });
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return jsonError("id is required.");
  }

  const db = getDb();
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return jsonOk({ deleted: true });
}
