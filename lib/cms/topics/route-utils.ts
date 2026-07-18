import { z } from "zod";
import { jsonOk } from "@/lib/cms/http";
import { isOpenRouterError } from "@/lib/integrations/openrouter";
import { TopicDomainError, topicErrorResponse } from "./errors";

export const topicIdSchema = z.string().uuid();

export function topicRouteError(error: unknown) {
  if (isOpenRouterError(error)) {
    return jsonOk(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  const normalized = topicErrorResponse(error);
  return jsonOk(
    { error: normalized.error, code: normalized.code },
    { status: normalized.status },
  );
}

export function validationError(message: string, details?: Record<string, unknown>) {
  return new TopicDomainError("VALIDATION_ERROR", message, { details });
}
