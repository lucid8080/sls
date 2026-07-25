import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { generateApiKey } from "@/lib/cms/agent-auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { apiKeys } from "@/lib/cms/db/schema";
import { getDb } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { AGENT_SCOPES, DEFAULT_AGENT_SCOPES, parseAgentScopes } from "@/lib/cms/schemas";

function routeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Unexpected CMS error.";
}

export async function GET() {
  try {
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
      availableScopes: AGENT_SCOPES,
    });
  } catch (error) {
    return jsonError(routeErrorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return jsonError("DATABASE_URL is not configured.", 503);
    }

    const session = await auth();
    if (!session) {
      return jsonError("Unauthorized.", 401);
    }

    const body = await readJsonBody<{ label?: string; scopes?: string[] }>(request);
    if (!body) {
      return jsonError("Invalid JSON body.");
    }
    if (!body.label?.trim()) {
      return jsonError("label is required.");
    }

    let scopes = DEFAULT_AGENT_SCOPES;
    if (body.scopes !== undefined) {
      const parsed = parseAgentScopes(body.scopes);
      if (!parsed.ok) {
        return jsonError(parsed.error);
      }
      scopes = parsed.scopes;
    }

    const generated = generateApiKey();
    const db = getDb();
    const [row] = await db
      .insert(apiKeys)
      .values({
        label: body.label.trim(),
        keyHash: generated.hash,
        keyPrefix: generated.prefix,
        scopes,
      })
      .returning();

    return jsonOk({
      id: row.id,
      label: row.label,
      prefix: row.keyPrefix,
      scopes: row.scopes,
      key: generated.key,
    });
  } catch (error) {
    return jsonError(routeErrorMessage(error), 500);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return jsonError("DATABASE_URL is not configured.", 503);
    }

    const session = await auth();
    if (!session) {
      return jsonError("Unauthorized.", 401);
    }

    const body = await readJsonBody<{ id?: string; label?: string; scopes?: string[] }>(request);
    if (!body) {
      return jsonError("Invalid JSON body.");
    }
    if (!body.id?.trim()) {
      return jsonError("id is required.");
    }
    if (body.scopes === undefined && body.label === undefined) {
      return jsonError("Nothing to update.");
    }

    const updates: { label?: string; scopes?: string[] } = {};

    if (body.label !== undefined) {
      if (!body.label.trim()) {
        return jsonError("label cannot be empty.");
      }
      updates.label = body.label.trim();
    }

    if (body.scopes !== undefined) {
      const parsed = parseAgentScopes(body.scopes);
      if (!parsed.ok) {
        return jsonError(parsed.error);
      }
      updates.scopes = parsed.scopes;
    }

    const db = getDb();
    const [row] = await db
      .update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, body.id.trim()))
      .returning();

    if (!row) {
      return jsonError("API key not found.", 404);
    }

    return jsonOk({
      key: {
        id: row.id,
        label: row.label,
        prefix: row.keyPrefix,
        scopes: row.scopes,
        lastUsedAt: row.lastUsedAt,
        createdAt: row.createdAt,
      },
    });
  } catch (error) {
    return jsonError(routeErrorMessage(error), 500);
  }
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
