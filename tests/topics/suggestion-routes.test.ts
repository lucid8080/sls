import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  generateTopicSuggestions: vi.fn(),
  applyTopicSuggestions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/cms/db/client", () => ({
  isDatabaseConfigured: mocks.isDatabaseConfigured,
  getDb: vi.fn(),
}));
vi.mock("@/lib/cms/topics/suggestion-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/cms/topics/suggestion-service")>();
  return {
    ...original,
    generateTopicSuggestions: mocks.generateTopicSuggestions,
    applyTopicSuggestions: mocks.applyTopicSuggestions,
  };
});

import { POST as generateSuggestions } from "@/app/api/cms/topics/[id]/suggestions/route";
import { POST as applySuggestions } from "@/app/api/cms/topics/[id]/suggestions/apply/route";

const topicId = "22222222-2222-4222-8222-222222222222";

describe("topic suggestion routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.auth.mockResolvedValue({ user: { email: "admin@example.com" } });
  });

  it("rejects unauthenticated suggestion generation", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await generateSuggestions(
      new Request("http://localhost/api/cms/topics/id/suggestions", { method: "POST" }),
      { params: Promise.resolve({ id: topicId }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns generated suggestions", async () => {
    mocks.generateTopicSuggestions.mockResolvedValue({
      suggestions: { title: "Improved title", rationale: "Clearer" },
      generatedAt: "2026-07-17T12:00:00.000Z",
      model: "openai/gpt-4o-mini",
      expectedUpdatedAt: "2026-07-17T11:00:00.000Z",
      warnings: [],
      topicStatus: "inbox",
    });

    const response = await generateSuggestions(
      new Request("http://localhost/api/cms/topics/id/suggestions", { method: "POST" }),
      { params: Promise.resolve({ id: topicId }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      model: "openai/gpt-4o-mini",
      topicStatus: "inbox",
    });
    expect(mocks.generateTopicSuggestions).toHaveBeenCalledWith(topicId, "admin@example.com");
  });

  it("validates apply payloads", async () => {
    const response = await applySuggestions(
      new Request("http://localhost/api/cms/topics/id/suggestions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedFields: [] }),
      }),
      { params: Promise.resolve({ id: topicId }) },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("applies selected fields through the suggestion service", async () => {
    mocks.applyTopicSuggestions.mockResolvedValue({
      id: topicId,
      status: "inbox",
      title: "Improved title",
    });

    const response = await applySuggestions(
      new Request("http://localhost/api/cms/topics/id/suggestions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: "2026-07-17T11:00:00.000Z",
          selectedFields: ["title"],
          suggestions: {
            title: "Improved title for kitchen cleaning guide",
            rationale: "Clearer SEO title",
          },
        }),
      }),
      { params: Promise.resolve({ id: topicId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.applyTopicSuggestions).toHaveBeenCalledWith(
      topicId,
      expect.objectContaining({
        selectedFields: ["title"],
      }),
      "admin@example.com",
    );
  });
});
