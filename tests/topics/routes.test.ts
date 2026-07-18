import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  listTopics: vi.fn(),
  countTopicsByStatus: vi.fn(),
  createTopicFromInput: vi.fn(),
  createManualSourceWithTopic: vi.fn(),
  createUrlSourceWithTopic: vi.fn(),
  listTopicSources: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/cms/db/client", () => ({
  isDatabaseConfigured: mocks.isDatabaseConfigured,
  getDb: vi.fn(),
}));
vi.mock("@/lib/cms/topics/repository", () => ({
  listTopics: mocks.listTopics,
  countTopicsByStatus: mocks.countTopicsByStatus,
  createTopicFromInput: mocks.createTopicFromInput,
}));
vi.mock("@/lib/cms/topics/source-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/cms/topics/source-service")>();
  return {
    ...original,
    createManualSourceWithTopic: mocks.createManualSourceWithTopic,
    createUrlSourceWithTopic: mocks.createUrlSourceWithTopic,
    listTopicSources: mocks.listTopicSources,
  };
});

import {
  GET as getTopics,
  POST as postTopic,
} from "@/app/api/cms/topics/route";
import {
  GET as getSources,
  POST as postSource,
} from "@/app/api/cms/topic-sources/route";
import { POST as fetchSource } from "@/app/api/cms/topic-sources/[id]/fetch/route";
import {
  determineSourceFetchStatus,
  inferManualSourceType,
} from "@/lib/cms/topics/source-service";

describe("Topic Inbox route boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.auth.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.listTopics.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    mocks.countTopicsByStatus.mockResolvedValue({
      inbox: 0,
      processing: 0,
      needs_review: 0,
      approved: 0,
      scheduled: 0,
      drafting: 0,
      published: 0,
      rejected: 0,
      archived: 0,
    });
  });

  it("rejects unauthenticated topic access", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await getTopics(new Request("http://localhost/api/cms/topics"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 503 when the database is unavailable", async () => {
    mocks.isDatabaseConfigured.mockReturnValue(false);
    const response = await getSources(
      new Request("http://localhost/api/cms/topic-sources"),
    );
    expect(response.status).toBe(503);
  });

  it("requires authentication for source fetching", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await fetchSource(
      new Request("http://localhost/api/cms/topic-sources/id/fetch", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(response.status).toBe(401);
  });

  it("validates topic list filters", async () => {
    const response = await getTopics(
      new Request("http://localhost/api/cms/topics?page=0"),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("passes pagination and status filters to the repository", async () => {
    const response = await getTopics(
      new Request(
        "http://localhost/api/cms/topics?page=2&pageSize=10&status=approved",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.listTopics).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10, status: "approved" }),
    );
  });

  it("rejects invalid standalone topic creation", async () => {
    const response = await postTopic(
      new Request("http://localhost/api/cms/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.createTopicFromInput).not.toHaveBeenCalled();
  });

  it("creates a manual Topic Source and Topic", async () => {
    mocks.createManualSourceWithTopic.mockResolvedValue({
      source: { id: "source-id" },
      topic: { id: "topic-id", status: "inbox" },
    });
    const response = await postSource(
      new Request("http://localhost/api/cms/topic-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputValue: "robot vacuum maintenance",
          sourceType: "keyword",
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.createManualSourceWithTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        inputValue: "robot vacuum maintenance",
        sourceType: "keyword",
      }),
      "admin@example.com",
    );
  });

  it("routes URL capture through the URL source service", async () => {
    mocks.createUrlSourceWithTopic.mockResolvedValue({
      source: { id: "source-id", fetchStatus: "pending" },
      topic: { id: "topic-id", status: "inbox" },
    });
    const response = await postSource(
      new Request("http://localhost/api/cms/topic-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputValue: "https://example.com/article",
          sourceUrl: "https://example.com/article",
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.createUrlSourceWithTopic).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: "https://example.com/article" }),
      "admin@example.com",
    );
  });

  it("does not downgrade an invalid URL payload into a manual source", async () => {
    const response = await postSource(
      new Request("http://localhost/api/cms/topic-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputValue: "javascript:alert(1)",
          sourceUrl: "javascript:alert(1)",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.createManualSourceWithTopic).not.toHaveBeenCalled();
    expect(mocks.createUrlSourceWithTopic).not.toHaveBeenCalled();
  });
});

describe("manual source classification", () => {
  it("distinguishes likely keywords from full ideas", () => {
    expect(inferManualSourceType("robot vacuum maintenance")).toBe("keyword");
    expect(
      inferManualSourceType(
        "Explain why a robot vacuum loses suction after several weeks of use.",
      ),
    ).toBe("manual");
  });

  it("marks restricted social extraction as limited", () => {
    expect(determineSourceFetchStatus("instagram")).toBe("limited");
    expect(determineSourceFetchStatus("x")).toBe("limited");
    expect(determineSourceFetchStatus("generic_web")).toBe("completed");
    expect(determineSourceFetchStatus("youtube")).toBe("completed");
  });
});
