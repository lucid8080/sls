import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  generateArticleSuggestions: vi.fn(),
  applyArticleSuggestions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/cms/db/client", () => ({
  isDatabaseConfigured: mocks.isDatabaseConfigured,
  getDb: vi.fn(),
}));
vi.mock("@/lib/cms/article-suggestions", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/cms/article-suggestions")>();
  return {
    ...original,
    generateArticleSuggestions: mocks.generateArticleSuggestions,
    applyArticleSuggestions: mocks.applyArticleSuggestions,
  };
});

import { POST as generateSuggestions } from "@/app/api/cms/articles/[id]/suggestions/route";
import { POST as applySuggestions } from "@/app/api/cms/articles/[id]/suggestions/apply/route";

describe("article suggestion routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.auth.mockResolvedValue({ user: { email: "admin@example.com" } });
  });

  it("rejects unauthenticated generation", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await generateSuggestions(
      new Request("http://localhost/api/cms/articles/cms_abc/suggestions", { method: "POST" }),
      { params: Promise.resolve({ id: "cms_abc" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns generated suggestions", async () => {
    mocks.generateArticleSuggestions.mockResolvedValue({
      suggestions: { title: "Improved title", rationale: "Clearer" },
      generatedAt: "2026-07-17T12:00:00.000Z",
      model: "openai/gpt-4o-mini",
      expectedUpdatedAt: "2026-07-17T11:00:00.000Z",
      articleStatus: "draft",
    });

    const response = await generateSuggestions(
      new Request("http://localhost/api/cms/articles/cms_abc/suggestions", { method: "POST" }),
      { params: Promise.resolve({ id: "cms_abc" }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      articleStatus: "draft",
      model: "openai/gpt-4o-mini",
    });
  });

  it("validates apply payloads", async () => {
    const response = await applySuggestions(
      new Request("http://localhost/api/cms/articles/cms_abc/suggestions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedFields: [] }),
      }),
      { params: Promise.resolve({ id: "cms_abc" }) },
    );
    expect(response.status).toBe(400);
  });

  it("applies selected fields", async () => {
    mocks.applyArticleSuggestions.mockResolvedValue({
      id: "cms_abc",
      title: "Improved title",
      status: "draft",
    });

    const response = await applySuggestions(
      new Request("http://localhost/api/cms/articles/cms_abc/suggestions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: "2026-07-17T11:00:00.000Z",
          selectedFields: ["title"],
          suggestions: {
            title: "Improved dishwasher cleaning guide for busy homes",
          },
        }),
      }),
      { params: Promise.resolve({ id: "cms_abc" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.applyArticleSuggestions).toHaveBeenCalledWith(
      "cms_abc",
      expect.objectContaining({ selectedFields: ["title"] }),
      "admin@example.com",
    );
  });
});
