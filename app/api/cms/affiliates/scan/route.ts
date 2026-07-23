import { auth } from "@/lib/auth";
import { scanAndUpsertAffiliateLinks } from "@/lib/cms/affiliate-scan";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk } from "@/lib/cms/http";

export async function POST() {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const result = await scanAndUpsertAffiliateLinks();
    return jsonOk({ scan: result });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to scan affiliate links.",
      500,
    );
  }
}
