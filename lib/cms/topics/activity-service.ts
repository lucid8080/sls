import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/cms/db/client";
import { topicActivity, type TopicActivityRow } from "@/lib/cms/db/schema";
import {
  TOPIC_ACTIVITY_METADATA_MAX_DEPTH,
  TOPIC_ACTIVITY_METADATA_MAX_KEYS,
  TOPIC_ACTIVITY_METADATA_MAX_STRING,
} from "./constants";
import type { RecordTopicActivityInput } from "./types";

const SENSITIVE_KEY_RE =
  /^(authorization|cookie|set-cookie|password|secret|token|api[_-]?key|database_url|private[_-]?key)$/i;

/**
 * Bound and scrub activity metadata so logs never hold secrets or unbounded payloads.
 */
export function sanitizeActivityMetadata(
  metadata: Record<string, unknown> | null | undefined,
  depth = 0,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  if (depth >= TOPIC_ACTIVITY_METADATA_MAX_DEPTH) {
    return { truncated: true };
  }

  const entries = Object.entries(metadata).slice(0, TOPIC_ACTIVITY_METADATA_MAX_KEYS);
  const result: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    if (SENSITIVE_KEY_RE.test(key)) {
      result[key] = "[redacted]";
      continue;
    }
    result[key] = sanitizeValue(value, depth);
  }

  return result;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > TOPIC_ACTIVITY_METADATA_MAX_STRING
      ? `${value.slice(0, TOPIC_ACTIVITY_METADATA_MAX_STRING)}…`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth + 1 >= TOPIC_ACTIVITY_METADATA_MAX_DEPTH) {
      return `[array:${value.length}]`;
    }
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    if (depth + 1 >= TOPIC_ACTIVITY_METADATA_MAX_DEPTH) {
      return "[object]";
    }
    return sanitizeActivityMetadata(value as Record<string, unknown>, depth + 1);
  }
  return String(value).slice(0, TOPIC_ACTIVITY_METADATA_MAX_STRING);
}

export async function recordTopicActivity(
  input: RecordTopicActivityInput,
): Promise<TopicActivityRow> {
  const db = getDb();
  const [row] = await db
    .insert(topicActivity)
    .values({
      topicId: input.topicId ?? null,
      sourceId: input.sourceId ?? null,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      metadata: sanitizeActivityMetadata(input.metadata),
    })
    .returning();

  return row;
}

export async function listTopicActivity(options: {
  topicId?: string;
  sourceId?: string;
  limit?: number;
}): Promise<TopicActivityRow[]> {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  if (options.topicId) {
    return db
      .select()
      .from(topicActivity)
      .where(eq(topicActivity.topicId, options.topicId))
      .orderBy(desc(topicActivity.createdAt))
      .limit(limit);
  }

  if (options.sourceId) {
    return db
      .select()
      .from(topicActivity)
      .where(eq(topicActivity.sourceId, options.sourceId))
      .orderBy(desc(topicActivity.createdAt))
      .limit(limit);
  }

  return db.select().from(topicActivity).orderBy(desc(topicActivity.createdAt)).limit(limit);
}
