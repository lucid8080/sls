import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk } from "@/lib/cms/http";
import { TopicDomainError } from "@/lib/cms/topics/errors";
import { topicIdSchema, topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { generateTopicSuggestions } from "@/lib/cms/topics/suggestion-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  try {
    const session = await auth();
    if (!session) {
      throw new TopicDomainError("AUTH_REQUIRED", "Unauthorized.");
    }

    const { id } = await context.params;
    if (!topicIdSchema.safeParse(id).success) {
      throw validationError("Invalid topic ID.");
    }

    const result = await generateTopicSuggestions(id, session.user?.email ?? "admin");
    return jsonOk(result);
  } catch (error) {
    return topicRouteError(error);
  }
}
