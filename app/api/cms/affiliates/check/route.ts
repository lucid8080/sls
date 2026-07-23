import { auth } from "@/lib/auth";
import { checkAffiliateLinks } from "@/lib/cms/affiliate-links";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await readJsonBody<{ ids?: string[] }>(request);

  try {
    const links = await checkAffiliateLinks(body?.ids);
    return jsonOk({ links, checked: links.length });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to check affiliate links.",
      500,
    );
  }
}
