import { auth } from "@/lib/auth";
import { listCalendarEntries, upsertCalendarEntry } from "@/lib/cms/articles";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const entries = await listCalendarEntries(from, to);
  return jsonOk({ entries });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await readJsonBody<{
    calendarDate: string;
    topic: string;
    contentType?: string;
    categorySlug?: string;
    internalLinkTargets?: string[];
    seoChecklist?: Record<string, unknown>;
    notes?: string;
  }>(request);

  if (!body?.calendarDate || !body.topic) {
    return jsonError("calendarDate and topic are required.");
  }

  const entry = await upsertCalendarEntry(body);
  return jsonOk({ entry });
}
