import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAgentRequest: vi.fn(),
}));

vi.mock("@/lib/cms/agent-auth", () => ({
  verifyAgentRequest: mocks.verifyAgentRequest,
}));

import { GET as getAgentIndex, OPTIONS as optionsAgentIndex } from "@/app/api/agent/v1/route";

describe("Agent v1 index route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns JSON when the API key is valid", async () => {
    mocks.verifyAgentRequest.mockResolvedValue({
      ok: true,
      keyId: "key-1",
      label: "Hermes",
      scopes: ["agent:read"],
    });

    const response = await getAgentIndex(
      new Request("http://localhost/api/agent/v1", {
        headers: { authorization: "Bearer sls_test" },
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      api: "sls-agent",
      version: "v1",
      keyLabel: "Hermes",
      endpoints: {
        articles: "/api/agent/v1/articles",
      },
    });
  });

  it("returns JSON errors instead of an empty body when auth fails", async () => {
    mocks.verifyAgentRequest.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Missing or invalid Authorization header.",
    });

    const response = await getAgentIndex(new Request("http://localhost/api/agent/v1"));
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body.length).toBeGreaterThan(0);
    expect(JSON.parse(body)).toEqual({ error: "Missing or invalid Authorization header." });
  });

  it("returns a JSON body for OPTIONS connection probes", async () => {
    const response = await optionsAgentIndex();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(JSON.parse(body)).toMatchObject({ ok: true, api: "sls-agent", version: "v1" });
  });
});
