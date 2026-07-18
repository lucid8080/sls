import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/cms/db/client";
import { apiKeys } from "@/lib/cms/db/schema";
import type { AgentScope } from "@/lib/cms/schemas";

export type AgentAuthResult =
  | { ok: true; keyId: string; label: string; scopes: AgentScope[] }
  | { ok: false; status: number; error: string };

/** Skip lastUsedAt writes when the previous stamp is newer than this window. */
export const AGENT_LAST_USED_THROTTLE_MS = 30 * 60 * 1000;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `sls_${randomBytes(24).toString("hex")}`;
  return {
    key,
    prefix: key.slice(0, 12),
    hash: hashApiKey(key),
  };
}

export function shouldUpdateLastUsedAt(
  lastUsedAt: Date | string | null | undefined,
  now = new Date(),
  throttleMs = AGENT_LAST_USED_THROTTLE_MS,
): boolean {
  if (!lastUsedAt) {
    return true;
  }

  const previous = lastUsedAt instanceof Date ? lastUsedAt : new Date(lastUsedAt);
  if (Number.isNaN(previous.getTime())) {
    return true;
  }

  return now.getTime() - previous.getTime() >= throttleMs;
}

export async function verifyAgentRequest(
  authorization: string | null,
  requiredScope?: AgentScope,
): Promise<AgentAuthResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, status: 503, error: "CMS database is not configured." };
  }

  const token = parseBearerToken(authorization);
  if (!token) {
    return { ok: false, status: 401, error: "Missing or invalid Authorization header." };
  }

  const hash = hashApiKey(token);
  const db = getDb();
  const [record] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);

  if (!record) {
    return { ok: false, status: 401, error: "Invalid API key." };
  }

  const scopes = (record.scopes ?? []) as AgentScope[];
  if (requiredScope && !scopes.includes(requiredScope)) {
    return { ok: false, status: 403, error: `Missing required scope: ${requiredScope}` };
  }

  if (shouldUpdateLastUsedAt(record.lastUsedAt)) {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.id));
  }

  return {
    ok: true,
    keyId: record.id,
    label: record.label,
    scopes,
  };
}

export function hasScope(scopes: AgentScope[], scope: AgentScope): boolean {
  return scopes.includes(scope);
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}
