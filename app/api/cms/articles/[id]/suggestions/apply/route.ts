import { auth } from "@/lib/auth";
import {
  applyArticleSuggestions,
  articleSuggestionApplySchema,
} from "@/lib/cms/article-suggestions";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { isOpenRouterError } from "@/lib/integrations/openrouter";
import { TopicDomainError, topicErrorResponse } from "@/lib/cms/topics/errors";

type RouteContext = { params: Promise<{ id: string }> };

function routeError(error: unknown) {
  if (isOpenRouterError(error)) {
    return jsonOk({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof TopicDomainError) {
    const normalized = topicErrorResponse(error);
    return jsonOk(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status },
    );
  }
  const normalized = topicErrorResponse(error);
  return jsonOk(
    { error: normalized.error, code: normalized.code },
    { status: normalized.status },
  );
}

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
    if (!id?.trim()) {
      throw new TopicDomainError("VALIDATION_ERROR", "Invalid article ID.");
    }

    const body = await readJsonBody<unknown>(request);
    const parsed = articleSuggestionApplySchema.safeParse(body);
    if (!parsed.success) {
      throw new TopicDomainError("VALIDATION_ERROR", "Invalid suggestion apply payload.");
    }

    const article = await applyArticleSuggestions(
      id,
      parsed.data,
      session.user?.email ?? "admin",
    );
    return jsonOk({ article });
  } catch (error) {
    return routeError(error);
  }
}
