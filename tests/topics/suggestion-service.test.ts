import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTopicWithSources: vi.fn(),
  updateTopicById: vi.fn(),
  recordTopicActivity: vi.fn(),
  createStructuredCompletion: vi.fn(),
  isOpenRouterConfigured: vi.fn(),
}));

vi.mock("@/lib/cms/topics/repository", () => ({
  getTopicWithSources: mocks.getTopicWithSources,
  updateTopicById: mocks.updateTopicById,
}));
vi.mock("@/lib/cms/topics/activity-service", () => ({
  recordTopicActivity: mocks.recordTopicActivity,
}));
vi.mock("@/lib/integrations/openrouter", () => ({
  createStructuredCompletion: mocks.createStructuredCompletion,
  isOpenRouterConfigured: mocks.isOpenRouterConfigured,
}));

import {
  applyTopicSuggestions,
  generateTopicSuggestions,
} from "@/lib/cms/topics/suggestion-service";
import { TopicDomainError } from "@/lib/cms/topics/errors";

const topicId = "22222222-2222-4222-8222-222222222222";
const updatedAt = new Date("2026-07-17T11:00:00.000Z");

const topic = {
  id: topicId,
  title: "Old title",
  workingTitle: null,
  summary: null,
  angle: null,
  readerProblem: null,
  targetAudience: null,
  category: null,
  primaryKeyword: null,
  secondaryKeywords: [],
  searchIntent: null,
  relevanceScore: null,
  freshnessScore: null,
  evergreenScore: null,
  confidenceScore: null,
  priority: "normal",
  status: "inbox",
  editorNotes: null,
  rejectionReason: null,
  primarySourceId: null,
  articleId: null,
  calendarEntryId: null,
  mergedIntoTopicId: null,
  createdBy: "admin",
  approvedAt: null,
  scheduledAt: null,
  publishedAt: null,
  createdAt: updatedAt,
  updatedAt,
  primarySource: null,
  sources: [],
  links: [],
};

describe("topic suggestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOpenRouterConfigured.mockReturnValue(true);
    mocks.getTopicWithSources.mockResolvedValue(topic);
    mocks.recordTopicActivity.mockResolvedValue({});
  });

  it("throws AI_NOT_CONFIGURED when OpenRouter env is missing", async () => {
    mocks.isOpenRouterConfigured.mockReturnValue(false);
    await expect(generateTopicSuggestions(topicId)).rejects.toMatchObject({
      code: "AI_NOT_CONFIGURED",
    });
  });

  it("generates validated suggestions without changing status", async () => {
    mocks.createStructuredCompletion.mockResolvedValue({
      data: {
        title: "Better dishwasher cleaning guide for busy homes",
        workingTitle: "Dishwasher cleaning guide",
        summary: "Practical weekly cleaning habits.",
        angle: "Habits over products",
        readerProblem: "Cloudy glasses",
        targetAudience: "Homeowners",
        category: "Kitchen",
        primaryKeyword: "dishwasher cleaning",
        secondaryKeywords: ["kitchen"],
        searchIntent: "informational",
        relevanceScore: 80,
        freshnessScore: 60,
        evergreenScore: 90,
        confidenceScore: 70,
        priority: "high",
        rationale: "Evergreen kitchen topic",
      },
      model: "openai/gpt-4o-mini",
    });

    const result = await generateTopicSuggestions(topicId, "admin@example.com");
    expect(result.topicStatus).toBe("inbox");
    expect(result.expectedUpdatedAt).toBe(updatedAt.toISOString());
    expect(mocks.recordTopicActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "topic_ai_suggestions_generated" }),
    );
  });

  it("rejects stale apply requests and preserves status on success", async () => {
    await expect(
      applyTopicSuggestions(
        topicId,
        {
          expectedUpdatedAt: "2026-07-17T10:00:00.000Z",
          selectedFields: ["title"],
          suggestions: {
            title: "Better dishwasher cleaning guide for busy homes",
          },
        },
        "admin@example.com",
      ),
    ).rejects.toBeInstanceOf(TopicDomainError);

    mocks.updateTopicById.mockResolvedValue({ ...topic, title: "Better dishwasher cleaning guide for busy homes" });

    const updated = await applyTopicSuggestions(
      topicId,
      {
        expectedUpdatedAt: updatedAt.toISOString(),
        selectedFields: ["title"],
        suggestions: {
          title: "Better dishwasher cleaning guide for busy homes",
        },
      },
      "admin@example.com",
    );

    expect(updated.status).toBe("inbox");
    expect(mocks.updateTopicById).toHaveBeenCalledWith(
      topicId,
      { title: "Better dishwasher cleaning guide for busy homes" },
      "admin@example.com",
    );
    expect(mocks.recordTopicActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "topic_ai_suggestions_applied" }),
    );
  });
});
