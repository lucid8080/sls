import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  OpenRouterError,
  createStructuredCompletion,
  getOpenRouterConfig,
  isOpenRouterConfigured,
} from "@/lib/integrations/openrouter/client";

const sampleSchema = z
  .object({
    title: z.string().min(1).max(180),
    score: z.number().int().min(0).max(100),
  })
  .strict();

const sampleJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "score"],
  properties: {
    title: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
  },
};

describe("OpenRouter client configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports not configured when the API key or model is missing", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_MODEL", "");
    expect(isOpenRouterConfigured()).toBe(false);
    expect(getOpenRouterConfig()).toBeNull();
  });

  it("reads bounded timeout and attribution settings", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");
    vi.stubEnv("OPENROUTER_TIMEOUT_MS", "45000");
    vi.stubEnv("OPENROUTER_SITE_URL", "https://simplelifesaver.com");
    vi.stubEnv("OPENROUTER_APP_NAME", "Simple Life Saver CMS");

    expect(isOpenRouterConfigured()).toBe(true);
    expect(getOpenRouterConfig()).toMatchObject({
      apiKey: "test-key",
      model: "openai/gpt-4o-mini",
      timeoutMs: 45_000,
      siteUrl: "https://simplelifesaver.com",
      appName: "Simple Life Saver CMS",
    });
  });
});

describe("OpenRouter structured completions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws AI_NOT_CONFIGURED when credentials are missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_MODEL", "");

    await expect(
      createStructuredCompletion({
        schemaName: "sample",
        jsonSchema: sampleJsonSchema,
        zodSchema: sampleSchema,
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toMatchObject({
      code: "AI_NOT_CONFIGURED",
      status: 503,
    });
  });

  it("returns validated structured output from a successful response", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");

    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "gen-1",
        model: "openai/gpt-4o-mini",
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({ title: "Clean kitchen tips", score: 88 }),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );

    const result = await createStructuredCompletion({
      schemaName: "sample",
      jsonSchema: sampleJsonSchema,
      zodSchema: sampleSchema,
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: "Suggest a title." },
      ],
      fetchImpl,
    });

    expect(result.data).toEqual({ title: "Clean kitchen tips", score: 88 });
    expect(result.model).toBe("openai/gpt-4o-mini");
    expect(result.usage?.totalTokens).toBe(15);

    const call = fetchImpl.mock.calls[0] as unknown as [
      string | URL | Request,
      RequestInit | undefined,
    ];
    const init = call[1];
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      response_format: { type: string };
    };
    expect(body.model).toBe("openai/gpt-4o-mini");
    expect(body.response_format.type).toBe("json_schema");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
  });

  it("maps 429 responses to AI_RATE_LIMITED", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");

    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createStructuredCompletion({
        schemaName: "sample",
        jsonSchema: sampleJsonSchema,
        zodSchema: sampleSchema,
        messages: [{ role: "user", content: "hello" }],
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
      status: 429,
    });
  });

  it("rejects malformed JSON content as AI_INVALID_RESPONSE", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");

    const fetchImpl = vi.fn(async () =>
      Response.json({
        model: "openai/gpt-4o-mini",
        choices: [{ message: { role: "assistant", content: "{not-json" } }],
      }),
    );

    await expect(
      createStructuredCompletion({
        schemaName: "sample",
        jsonSchema: sampleJsonSchema,
        zodSchema: sampleSchema,
        messages: [{ role: "user", content: "hello" }],
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(OpenRouterError);
  });

  it("rejects schema-invalid JSON as AI_INVALID_RESPONSE", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");

    const fetchImpl = vi.fn(async () =>
      Response.json({
        model: "openai/gpt-4o-mini",
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({ title: "ok", score: 999, extra: true }),
            },
          },
        ],
      }),
    );

    await expect(
      createStructuredCompletion({
        schemaName: "sample",
        jsonSchema: sampleJsonSchema,
        zodSchema: sampleSchema,
        messages: [{ role: "user", content: "hello" }],
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
      status: 502,
    });
  });

  it("maps aborted requests to AI_TIMEOUT", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");
    vi.stubEnv("OPENROUTER_TIMEOUT_MS", "1000");

    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const error = new Error("aborted");
      error.name = "AbortError";
      if (init?.signal?.aborted) {
        throw error;
      }
      throw error;
    });

    await expect(
      createStructuredCompletion({
        schemaName: "sample",
        jsonSchema: sampleJsonSchema,
        zodSchema: sampleSchema,
        messages: [{ role: "user", content: "hello" }],
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      status: 504,
    });
  });
});
