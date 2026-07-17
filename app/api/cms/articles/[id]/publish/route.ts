import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk } from "@/lib/cms/http";
import { publishArticle, submitForReview } from "@/lib/cms/publish";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "publish";
  const actor = session.user?.email ?? "admin";

  if (action === "review") {
    const result = await submitForReview(id, actor);
    if (!result.ok) {
      return jsonError(result.error ?? "Failed.", 400);
    }
    return jsonOk(result);
  }

  const result = await publishArticle(id, actor);
  if (!result.ok) {
    return jsonError(result.error ?? "Publish failed.", 422);
  }

  return jsonOk(result);
}
