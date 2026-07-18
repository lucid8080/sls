import { z } from "zod";

export const OPENROUTER_ERROR_CODES = [
  "AI_NOT_CONFIGURED",
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "AI_INVALID_RESPONSE",
  "AI_PROVIDER_ERROR",
] as const;

export type OpenRouterErrorCode = (typeof OPENROUTER_ERROR_CODES)[number];

export type OpenRouterConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxResponseBytes: number;
  siteUrl?: string;
  appName?: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StructuredCompletionResult<T> = {
  data: T;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export class OpenRouterError extends Error {
  readonly code: OpenRouterErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: OpenRouterErrorCode,
    message: string,
    options?: { status?: number; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "OpenRouterError";
    this.code = code;
    this.status = options?.status ?? defaultStatusForCode(code);
    this.details = options?.details;
  }
}

export function isOpenRouterError(error: unknown): error is OpenRouterError {
  return error instanceof OpenRouterError;
}

function defaultStatusForCode(code: OpenRouterErrorCode): number {
  switch (code) {
    case "AI_NOT_CONFIGURED":
      return 503;
    case "AI_RATE_LIMITED":
      return 429;
    case "AI_TIMEOUT":
      return 504;
    case "AI_INVALID_RESPONSE":
    case "AI_PROVIDER_ERROR":
      return 502;
    default:
      return 500;
  }
}

function boundedEnvNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export function getOpenRouterConfig(): OpenRouterConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !model) {
    return null;
  }

  return {
    apiKey,
    model,
    timeoutMs: boundedEnvNumber("OPENROUTER_TIMEOUT_MS", 30_000, 3_000, 90_000),
    maxResponseBytes: boundedEnvNumber(
      "OPENROUTER_MAX_RESPONSE_BYTES",
      500_000,
      8_000,
      2_000_000,
    ),
    siteUrl: process.env.OPENROUTER_SITE_URL?.trim() || undefined,
    appName: process.env.OPENROUTER_APP_NAME?.trim() || undefined,
  };
}

export function isOpenRouterConfigured(): boolean {
  return getOpenRouterConfig() !== null;
}

type CreateStructuredCompletionOptions<T> = {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodType<T>;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
  config?: OpenRouterConfig | null;
};

export async function createStructuredCompletion<T>(
  options: CreateStructuredCompletionOptions<T>,
): Promise<StructuredCompletionResult<T>> {
  const config = options.config === undefined ? getOpenRouterConfig() : options.config;
  if (!config) {
    throw new OpenRouterError(
      "AI_NOT_CONFIGURED",
      "OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_MODEL.",
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(config.siteUrl ? { "HTTP-Referer": config.siteUrl } : {}),
        ...(config.appName ? { "X-Title": config.appName } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2_000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: options.schemaName,
            strict: true,
            schema: options.jsonSchema,
          },
        },
      }),
      signal: controller.signal,
    });

    const rawText = await readBoundedText(response, config.maxResponseBytes);

    if (response.status === 429) {
      throw new OpenRouterError("AI_RATE_LIMITED", "OpenRouter rate limit reached. Try again shortly.", {
        status: 429,
      });
    }

    if (!response.ok) {
      throw new OpenRouterError(
        "AI_PROVIDER_ERROR",
        `OpenRouter request failed with status ${response.status}.`,
        {
          status: 502,
          details: { httpStatus: response.status },
        },
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch (cause) {
      throw new OpenRouterError("AI_INVALID_RESPONSE", "OpenRouter returned invalid JSON.", {
        cause,
      });
    }

    const content = extractMessageContent(payload);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content) as unknown;
    } catch (cause) {
      throw new OpenRouterError(
        "AI_INVALID_RESPONSE",
        "OpenRouter returned non-JSON structured content.",
        { cause },
      );
    }

    const validated = options.zodSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new OpenRouterError(
        "AI_INVALID_RESPONSE",
        "OpenRouter response failed schema validation.",
        {
          details: { issueCount: validated.error.issues.length },
        },
      );
    }

    const model =
      typeof payload === "object" &&
      payload &&
      "model" in payload &&
      typeof payload.model === "string"
        ? payload.model
        : config.model;

    return {
      data: validated.data,
      model,
      usage: extractUsage(payload),
    };
  } catch (error) {
    if (isOpenRouterError(error)) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterError("AI_TIMEOUT", "OpenRouter request timed out.", {
        status: 504,
        cause: error,
      });
    }
    throw new OpenRouterError("AI_PROVIDER_ERROR", "OpenRouter request failed.", {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") ?? NaN);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new OpenRouterError("AI_INVALID_RESPONSE", "OpenRouter response exceeded size limit.");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new OpenRouterError("AI_INVALID_RESPONSE", "OpenRouter response exceeded size limit.");
  }
  return new TextDecoder("utf-8").decode(buffer);
}

function extractMessageContent(payload: unknown): string {
  if (
    typeof payload !== "object" ||
    !payload ||
    !("choices" in payload) ||
    !Array.isArray(payload.choices) ||
    payload.choices.length === 0
  ) {
    throw new OpenRouterError("AI_INVALID_RESPONSE", "OpenRouter response missing choices.");
  }

  const first = payload.choices[0] as unknown;
  if (
    typeof first !== "object" ||
    !first ||
    !("message" in first) ||
    typeof first.message !== "object" ||
    !first.message ||
    !("content" in first.message)
  ) {
    throw new OpenRouterError("AI_INVALID_RESPONSE", "OpenRouter response missing message content.");
  }

  const content = first.message.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }

  throw new OpenRouterError("AI_INVALID_RESPONSE", "OpenRouter response content was empty.");
}

function extractUsage(payload: unknown): StructuredCompletionResult<unknown>["usage"] {
  if (typeof payload !== "object" || !payload || !("usage" in payload)) {
    return undefined;
  }
  const usage = payload.usage;
  if (typeof usage !== "object" || !usage) {
    return undefined;
  }

  return {
    promptTokens:
      "prompt_tokens" in usage && typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens
        : undefined,
    completionTokens:
      "completion_tokens" in usage && typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : undefined,
    totalTokens:
      "total_tokens" in usage && typeof usage.total_tokens === "number"
        ? usage.total_tokens
        : undefined,
  };
}
