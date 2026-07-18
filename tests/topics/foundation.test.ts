import { describe, expect, it } from "vitest";
import { sanitizeActivityMetadata } from "@/lib/cms/topics/activity-service";
import { ALLOWED_TOPIC_TRANSITIONS, TOPIC_STATUSES } from "@/lib/cms/topics/constants";
import { TopicDomainError, topicErrorResponse } from "@/lib/cms/topics/errors";
import {
  createManualTopicSourceSchema,
  createTopicSchema,
  createTopicSourceSchema,
  createUrlTopicSourceSchema,
  mergeTopicsSchema,
  scheduleTopicSchema,
  topicBulkActionSchema,
  topicListFiltersSchema,
  topicStatusChangeSchema,
  updateTopicSchema,
} from "@/lib/cms/topics/schemas";
import {
  assertTopicTransition,
  canTransitionTopicStatus,
  getAllowedTransitions,
} from "@/lib/cms/topics/transition-service";

describe("topic status transitions", () => {
  it("exposes a transition for every status", () => {
    for (const status of TOPIC_STATUSES) {
      expect(ALLOWED_TOPIC_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(ALLOWED_TOPIC_TRANSITIONS[status])).toBe(true);
    }
  });

  it("allows approved → drafting and rejects published → drafting", () => {
    expect(canTransitionTopicStatus("approved", "drafting")).toBe(true);
    expect(canTransitionTopicStatus("published", "drafting")).toBe(false);
    expect(getAllowedTransitions("published")).toEqual(["archived"]);
  });

  it("throws INVALID_STATUS_TRANSITION for illegal moves", () => {
    expect(() => assertTopicTransition("inbox", "published")).toThrow(TopicDomainError);
    try {
      assertTopicTransition("needs_review", "drafting");
    } catch (error) {
      expect(error).toBeInstanceOf(TopicDomainError);
      expect((error as TopicDomainError).code).toBe("INVALID_STATUS_TRANSITION");
      const response = topicErrorResponse(error);
      expect(response.status).toBe(400);
      expect(response.error).toContain("Needs Review");
    }
  });

  it("does not treat same-status as a valid transition", () => {
    expect(canTransitionTopicStatus("approved", "approved")).toBe(false);
  });
});

describe("topic zod schemas", () => {
  it("accepts a manual topic source", () => {
    const parsed = createManualTopicSourceSchema.parse({
      inputValue: "robot vacuum maintenance tips",
      sourceType: "keyword",
      editorNotes: "Seasonal angle for spring cleaning.",
    });
    expect(parsed.sourceType).toBe("keyword");
  });

  it("rejects an empty manual input", () => {
    const result = createManualTopicSourceSchema.safeParse({ inputValue: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts a URL topic source", () => {
    const parsed = createUrlTopicSourceSchema.parse({
      inputValue: "https://example.com/guide",
      sourceUrl: "https://example.com/guide",
    });
    expect(parsed.sourceUrl).toBe("https://example.com/guide");
  });

  it("rejects an invalid URL source", () => {
    const result = createUrlTopicSourceSchema.safeParse({
      inputValue: "not-a-url",
      sourceUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
    expect(
      createTopicSourceSchema.safeParse({
        inputValue: "javascript:alert(1)",
        sourceUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("accepts topic create and update payloads", () => {
    const created = createTopicSchema.parse({
      title: "How to deep clean a robot vacuum",
      primaryKeyword: "robot vacuum cleaning",
      secondaryKeywords: ["maintenance", "filters"],
      searchIntent: "informational",
      relevanceScore: 80,
    });
    expect(created.status).toBeUndefined();

    const updated = updateTopicSchema.parse({
      workingTitle: "Deep-clean your robot vacuum in 20 minutes",
      priority: "high",
    });
    expect(updated.priority).toBe("high");
  });

  it("rejects empty topic updates", () => {
    expect(updateTopicSchema.safeParse({}).success).toBe(false);
  });

  it("validates status changes, bulk actions, schedule, and merge", () => {
    expect(topicStatusChangeSchema.parse({ toStatus: "approved" }).toStatus).toBe("approved");

    const bulk = topicBulkActionSchema.parse({
      topicIds: ["11111111-1111-4111-8111-111111111111"],
      action: "set_priority",
      priority: "urgent",
    });
    expect(bulk.action).toBe("set_priority");

    expect(scheduleTopicSchema.parse({ calendarDate: "2026-08-01" }).calendarDate).toBe(
      "2026-08-01",
    );
    expect(scheduleTopicSchema.safeParse({ calendarDate: "08/01/2026" }).success).toBe(false);

    expect(
      mergeTopicsSchema.safeParse({
        primaryTopicId: "11111111-1111-4111-8111-111111111111",
        secondaryTopicId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
  });

  it("parses list filters with defaults", () => {
    const filters = topicListFiltersSchema.parse({});
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(25);
    expect(filters.sort).toBe("updated_at");
    expect(filters.direction).toBe("desc");
  });

});

describe("topic activity metadata sanitization", () => {
  it("redacts secrets and truncates long strings", () => {
    const sanitized = sanitizeActivityMetadata({
      authorization: "Bearer secret-token",
      api_key: "abc123",
      note: "a".repeat(600),
      nested: { cookie: "session=1", ok: true },
      deep: { level2: { level3: { keep: "no" } } },
    });

    expect(sanitized).not.toBeNull();
    expect(sanitized!.authorization).toBe("[redacted]");
    expect(sanitized!.api_key).toBe("[redacted]");
    expect(String(sanitized!.note).endsWith("…")).toBe(true);
    expect((sanitized!.nested as Record<string, unknown>).cookie).toBe("[redacted]");
    expect(sanitized!.deep).toEqual({ level2: "[object]" });
  });

  it("returns null for empty metadata", () => {
    expect(sanitizeActivityMetadata(null)).toBeNull();
    expect(sanitizeActivityMetadata(undefined)).toBeNull();
  });
});
