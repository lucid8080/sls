import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { TopicDomainError } from "@/lib/cms/topics/errors";
import { topicIdSchema, topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { topicSuggestionApplySchema } from "@/lib/cms/topics/schemas";
import { applyTopicSuggestions } from "@/lib/cms/topics/suggestion-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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

    const body = await readJsonBody<unknown>(request);
    const parsed = topicSuggestionApplySchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid suggestion apply payload.");
    }

    const topic = await applyTopicSuggestions(id, parsed.data, session.user?.email ?? "admin");
    return jsonOk({ topic });
  } catch (error) {
    return topicRouteError(error);
  }
}
