import { auth } from "@/lib/auth";
import { fixAmazonAffiliateTags } from "@/lib/cms/affiliate-fix-tags";
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

  const body = await readJsonBody<{ dryRun?: boolean; linkId?: string }>(request);

  try {
    const result = await fixAmazonAffiliateTags({
      dryRun: Boolean(body?.dryRun),
      linkId: body?.linkId,
      actor: session.user?.email ?? "admin",
    });
    return jsonOk({ fix: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fix affiliate tags.";
    if (message === "Affiliate link not found.") {
      return jsonError(message, 404);
    }
    if (message.includes("only applies")) {
      return jsonError(message, 400);
    }
    return jsonError(message, 500);
  }
}
