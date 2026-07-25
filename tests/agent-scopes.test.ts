import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAgentRequest: vi.fn(),
  getAdSettings: vi.fn(),
  getDefaultAdSettings: vi.fn(),
  saveAdSettings: vi.fn(),
  listAffiliateLinks: vi.fn(),
  createManualAffiliateLink: vi.fn(),
  listAdminMedia: vi.fn(),
  listTopics: vi.fn(),
  countTopicsByStatus: vi.fn(),
  createTopicFromInput: vi.fn(),
}));

vi.mock("@/lib/cms/agent-auth", () => ({ verifyAgentRequest: mocks.verifyAgentRequest }));
vi.mock("@/lib/ads/settings", () => ({
  getAdSettings: mocks.getAdSettings,
  getDefaultAdSettings: mocks.getDefaultAdSettings,
}));
vi.mock("@/lib/ads/server-settings", () => ({ saveAdSettings: mocks.saveAdSettings }));
vi.mock("@/lib/cms/affiliate-links", () => ({
  listAffiliateLinks: mocks.listAffiliateLinks,
  createManualAffiliateLink: mocks.createManualAffiliateLink,
}));
vi.mock("@/lib/cms/admin-media", () => ({ listAdminMedia: mocks.listAdminMedia }));
vi.mock("@/lib/cms/db/client", () => ({ getDb: vi.fn(), isDatabaseConfigured: () => true }));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));
vi.mock("sharp", () => ({ default: vi.fn() }));
vi.mock("@/lib/cms/topics/repository", () => ({
  listTopics: mocks.listTopics,
  countTopicsByStatus: mocks.countTopicsByStatus,
  createTopicFromInput: mocks.createTopicFromInput,
}));

import { GET as getAds } from "@/app/api/agent/v1/ads/route";
import { GET as getAffiliates } from "@/app/api/agent/v1/affiliates/route";
import { GET as getMedia } from "@/app/api/agent/v1/media/route";
import { GET as getTopics } from "@/app/api/agent/v1/topics/route";
import { AGENT_SCOPES, parseAgentScopes, type AgentScope } from "@/lib/cms/schemas";

function allowScope(scope: AgentScope) {
  mocks.verifyAgentRequest.mockImplementation(async (_auth: string | null, required?: AgentScope) => {
    if (required && required !== scope) {
      return { ok: false, status: 403, error: `Missing required scope: ${required}` };
    }
    return { ok: true, keyId: "key-1", label: "Hermes", scopes: [scope] };
  });
}

const authorized = { headers: { authorization: "Bearer sls_test" } };

describe("parseAgentScopes", () => {
  it("rejects unknown scopes", () => {
    expect(parseAgentScopes(["agent:read", "agent:everything"])).toEqual({
      ok: false,
      error: "Unknown scopes: agent:everything",
    });
  });

  it("rejects empty selections and non-arrays", () => {
    expect(parseAgentScopes([])).toMatchObject({ ok: false });
    expect(parseAgentScopes("agent:read")).toMatchObject({ ok: false });
  });

  it("dedupes and orders scopes by the catalog", () => {
    expect(parseAgentScopes(["agent:topics", "agent:read", "agent:topics"])).toEqual({
      ok: true,
      scopes: ["agent:read", "agent:topics"],
    });
  });

  it("includes the new domain scopes in the catalog", () => {
    expect(AGENT_SCOPES).toEqual(
      expect.arrayContaining(["agent:ads", "agent:affiliates", "agent:media", "agent:topics"]),
    );
  });
});

describe("Agent v1 domain routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdSettings.mockResolvedValue({ globalEnabled: true, placements: {} });
    mocks.getDefaultAdSettings.mockReturnValue({ globalEnabled: false, placements: {} });
    mocks.listAffiliateLinks.mockResolvedValue([]);
    mocks.listAdminMedia.mockResolvedValue({ media: [], total: 0, limit: 50, offset: 0 });
    mocks.listTopics.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    mocks.countTopicsByStatus.mockResolvedValue({});
  });

  it("serves ad settings for agent:ads keys", async () => {
    allowScope("agent:ads");
    const response = await getAds(new Request("http://localhost/api/agent/v1/ads", authorized));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      settings: { globalEnabled: true },
    });
  });

  it("serves affiliate links for agent:affiliates keys", async () => {
    allowScope("agent:affiliates");
    const response = await getAffiliates(
      new Request("http://localhost/api/agent/v1/affiliates?network=amazon", authorized),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ links: [], count: 0 });
    expect(mocks.listAffiliateLinks).toHaveBeenCalledWith(
      expect.objectContaining({ network: "amazon" }),
    );
  });

  it("serves the media library for agent:media keys", async () => {
    allowScope("agent:media");
    const response = await getMedia(
      new Request("http://localhost/api/agent/v1/media?search=vacuum&limit=10", authorized),
    );

    expect(response.status).toBe(200);
    expect(mocks.listAdminMedia).toHaveBeenCalledWith(
      expect.objectContaining({ search: "vacuum", limit: 10 }),
    );
  });

  it("serves the topic inbox for agent:topics keys", async () => {
    allowScope("agent:topics");
    const response = await getTopics(
      new Request("http://localhost/api/agent/v1/topics?page=2&pageSize=10", authorized),
    );

    expect(response.status).toBe(200);
    expect(mocks.listTopics).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
  });

  it("returns 403 when the key lacks the domain scope", async () => {
    allowScope("agent:read");

    const responses = await Promise.all([
      getAds(new Request("http://localhost/api/agent/v1/ads", authorized)),
      getAffiliates(new Request("http://localhost/api/agent/v1/affiliates", authorized)),
      getMedia(new Request("http://localhost/api/agent/v1/media", authorized)),
      getTopics(new Request("http://localhost/api/agent/v1/topics", authorized)),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringContaining("Missing required scope"),
      });
    }
  });
});
