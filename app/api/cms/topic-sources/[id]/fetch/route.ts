import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk } from "@/lib/cms/http";
import { topicIdSchema, topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { processTopicSource } from "@/lib/cms/topics/source-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }
  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const { id } = await context.params;
    if (!topicIdSchema.safeParse(id).success) {
      throw validationError("Invalid source ID.");
    }
    const source = await processTopicSource(
      id,
      session.user?.email ?? "admin",
    );
    return jsonOk({ source });
  } catch (error) {
    return topicRouteError(error);
  }
}
