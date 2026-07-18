import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/cms/db/client", () => ({
  getDb: mocks.getDb,
}));

import { topicErrorResponse } from "@/lib/cms/topics/errors";
import { createManualSourceWithTopic } from "@/lib/cms/topics/source-service";

describe("createManualSourceWithTopic without transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(() => {
      throw new Error("No transactions support in neon-http driver");
    });
    mocks.getDb.mockReturnValue({
      insert: mocks.insert,
      delete: mocks.delete,
      transaction: mocks.transaction,
    });
  });

  it("creates source + topic with sequential inserts (no transaction)", async () => {
    const source = { id: "11111111-1111-4111-8111-111111111111" };
    const topic = {
      id: "22222222-2222-4222-8222-222222222222",
      status: "inbox",
      title: "20 Home Maintenance Tasks That Prevent Expensive Repairs",
    };

    let call = 0;
    mocks.insert.mockImplementation(() => ({
      values: () => {
        call += 1;
        if (call === 1) {
          return { returning: async () => [source] };
        }
        if (call === 2) {
          return { returning: async () => [topic] };
        }
        return Promise.resolve([]);
      },
    }));

    const result = await createManualSourceWithTopic(
      {
        inputValue: "20 Home Maintenance Tasks That Prevent Expensive Repairs",
        sourceType: "keyword",
      },
      "admin@example.com",
    );

    expect(result.topic.id).toBe(topic.id);
    expect(result.source.id).toBe(source.id);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(call).toBe(4);
  });
});

describe("topicErrorResponse", () => {
  it("maps neon-http transaction failures to a clear message", () => {
    const result = topicErrorResponse(new Error("No transactions support in neon-http driver"));
    expect(result.status).toBe(500);
    expect(result.error).toMatch(/cannot run transactions/i);
  });

  it("maps missing relation errors to schema guidance", () => {
    const result = topicErrorResponse(new Error('relation "topics" does not exist'));
    expect(result.code).toBe("DATABASE_UNAVAILABLE");
    expect(result.error).toMatch(/db:push/i);
  });
});
