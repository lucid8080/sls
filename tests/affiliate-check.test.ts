import { describe, expect, it, vi } from "vitest";
import { checkAffiliateUrl, classifyHttpStatus } from "@/lib/cms/affiliate-check";

describe("affiliate-check", () => {
  it("classifies HTTP statuses", () => {
    expect(classifyHttpStatus(200)).toBe("active");
    expect(classifyHttpStatus(404)).toBe("dead");
    expect(classifyHttpStatus(410)).toBe("dead");
    expect(classifyHttpStatus(301, { redirected: true })).toBe("redirected");
    expect(classifyHttpStatus(302)).toBe("redirected");
    expect(classifyHttpStatus(403)).toBe("blocked");
    expect(classifyHttpStatus(503)).toBe("blocked");
    expect(classifyHttpStatus(500)).toBe("error");
  });

  it("returns active for 200 responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const result = await checkAffiliateUrl("https://www.amazon.com/dp/B01MT0UL8N", { fetchImpl });
    expect(result).toEqual({
      liveStatus: "active",
      liveStatusCode: 200,
      liveFinalUrl: null,
      liveError: null,
    });
  });

  it("records redirects without following", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 301,
          headers: { location: "https://www.amazon.com/dp/B01MT0UL8N?tag=sls0fa-20" },
        }),
    );
    const result = await checkAffiliateUrl("https://amzn.to/abc", { fetchImpl });
    expect(result.liveStatus).toBe("redirected");
    expect(result.liveStatusCode).toBe(301);
    expect(result.liveFinalUrl).toContain("amazon.com/dp/B01MT0UL8N");
  });

  it("returns error on network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    const result = await checkAffiliateUrl("https://www.amazon.com/dp/B01MT0UL8N", { fetchImpl });
    expect(result.liveStatus).toBe("error");
    expect(result.liveError).toContain("ENOTFOUND");
  });
});
