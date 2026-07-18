export const TOPIC_ERROR_CODES = [
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "INVALID_STATUS_TRANSITION",
  "SOURCE_URL_UNSAFE",
  "SOURCE_FETCH_TIMEOUT",
  "SOURCE_FETCH_TOO_LARGE",
  "SOURCE_CONTENT_UNSUPPORTED",
  "SOURCE_FETCH_FAILED",
  "SOURCE_METADATA_LIMITED",
  "DUPLICATE_CONVERSION",
  "DUPLICATE_SCHEDULE",
  "DATABASE_UNAVAILABLE",
  "STALE_SUGGESTION",
  "AI_NOT_CONFIGURED",
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "AI_INVALID_RESPONSE",
  "AI_PROVIDER_ERROR",
  "INTERNAL_ERROR",
] as const;

export type TopicErrorCode = (typeof TOPIC_ERROR_CODES)[number];

export class TopicDomainError extends Error {
  readonly code: TopicErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TopicErrorCode,
    message: string,
    options?: { status?: number; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "TopicDomainError";
    this.code = code;
    this.status = options?.status ?? defaultStatusForCode(code);
    this.details = options?.details;
  }
}

export function defaultStatusForCode(code: TopicErrorCode): number {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
    case "INVALID_STATUS_TRANSITION":
    case "SOURCE_URL_UNSAFE":
    case "SOURCE_CONTENT_UNSUPPORTED":
    case "SOURCE_METADATA_LIMITED":
    case "DUPLICATE_CONVERSION":
    case "DUPLICATE_SCHEDULE":
    case "STALE_SUGGESTION":
      return 400;
    case "AI_RATE_LIMITED":
      return 429;
    case "DATABASE_UNAVAILABLE":
    case "AI_NOT_CONFIGURED":
      return 503;
    case "AI_TIMEOUT":
      return 504;
    case "SOURCE_FETCH_TIMEOUT":
    case "SOURCE_FETCH_TOO_LARGE":
    case "SOURCE_FETCH_FAILED":
    case "AI_INVALID_RESPONSE":
    case "AI_PROVIDER_ERROR":
      return 502;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}

export function isTopicDomainError(error: unknown): error is TopicDomainError {
  return error instanceof TopicDomainError;
}

/** Bounded message for API responses — never dump raw payloads. */
export function topicErrorResponse(error: unknown): { error: string; code?: TopicErrorCode; status: number } {
  if (isTopicDomainError(error)) {
    return { error: error.message, code: error.code, status: error.status };
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error("[cms/topics] unexpected error:", message);

  if (/no transactions support in neon-http/i.test(message)) {
    return {
      error:
        "Topic save failed because the database driver cannot run transactions. Retry after the server is updated.",
      code: "INTERNAL_ERROR",
      status: 500,
    };
  }

  if (/relation .* does not exist/i.test(message) || /column .* does not exist/i.test(message)) {
    return {
      error: "Topic tables are missing or out of date. Run npm run db:push, then try again.",
      code: "DATABASE_UNAVAILABLE",
      status: 503,
    };
  }

  return { error: "An unexpected error occurred.", code: "INTERNAL_ERROR", status: 500 };
}
