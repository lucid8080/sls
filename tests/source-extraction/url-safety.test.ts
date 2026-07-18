import { describe, expect, it, vi } from "vitest";
import { TopicDomainError } from "@/lib/cms/topics/errors";
import {
  fetchSafeUrl,
  type SafeRequest,
} from "@/lib/integrations/source-extraction/fetch-safe-url";
import { resolveHostSafely } from "@/lib/integrations/source-extraction/resolve-host-safely";
import {
  isPrivateOrReservedIp,
  parseSourceUrl,
} from "@/lib/integrations/source-extraction/validate-source-url";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function rawResponse(
  status: number,
  body = "<html><title>Example</title></html>",
  headers: Record<string, string> = { "content-type": "text/html" },
) {
  return { status, body, headers };
}

describe("source URL static safety", () => {
  it("accepts public HTTP and HTTPS URLs", () => {
    expect(parseSourceUrl("https://example.com/article").protocol).toBe("https:");
    expect(parseSourceUrl("http://example.com/article").protocol).toBe("http:");
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/file",
    "data:text/html,<h1>x</h1>",
    "javascript:alert(1)",
    "blob:https://example.com/id",
  ])("rejects the %s protocol", (url) => {
    expect(() => parseSourceUrl(url)).toThrow(TopicDomainError);
  });

  it.each([
    "http://localhost/",
    "http://api.localhost/",
    "http://internal/",
    "http://service.internal/",
    "http://router.lan/",
  ])("rejects internal hostname %s", (url) => {
    expect(() => parseSourceUrl(url)).toThrow(/public internet host/);
  });

  it.each([
    "127.0.0.1",
    "127.9.8.7",
    "10.1.2.3",
    "172.16.1.1",
    "172.31.255.254",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "0:0:0:0:0:0:0:1",
    "::",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])("identifies private or reserved IP %s", (address) => {
    expect(isPrivateOrReservedIp(address)).toBe(true);
  });

  it.each([
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://10.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
  ])("rejects direct private URL %s", (url) => {
    expect(() => parseSourceUrl(url)).toThrow(/public internet host/);
  });

  it("rejects hostnames when any DNS result is private", async () => {
    await expect(
      resolveHostSafely("example.com", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.4", family: 4 },
      ]),
    ).rejects.toMatchObject({ code: "SOURCE_URL_UNSAFE" });
  });
});

describe("safe fetch orchestration", () => {
  it("fetches a bounded supported public response", async () => {
    const request = vi.fn<SafeRequest>(async () => rawResponse(200));
    const result = await fetchSafeUrl("https://example.com/article", {
      lookup: publicLookup,
      request,
    });
    expect(result.finalUrl).toBe("https://example.com/article");
    expect(result.contentType).toBe("text/html");
    expect(request).toHaveBeenCalledOnce();
  });

  it("revalidates a redirect and blocks a private destination", async () => {
    const request = vi.fn<SafeRequest>(async () =>
      rawResponse(302, "", { location: "http://127.0.0.1/private" }),
    );
    await expect(
      fetchSafeUrl("https://example.com/article", {
        lookup: publicLookup,
        request,
      }),
    ).rejects.toMatchObject({ code: "SOURCE_URL_UNSAFE" });
    expect(request).toHaveBeenCalledOnce();
  });

  it("blocks an oversized response", async () => {
    const request = vi.fn<SafeRequest>(async () =>
      rawResponse(200, "x".repeat(101)),
    );
    await expect(
      fetchSafeUrl("https://example.com", {
        lookup: publicLookup,
        request,
        limits: { maxResponseBytes: 100 },
      }),
    ).rejects.toMatchObject({ code: "SOURCE_FETCH_TOO_LARGE" });
  });

  it("blocks unsupported content types", async () => {
    const request = vi.fn<SafeRequest>(async () =>
      rawResponse(200, "%PDF", { "content-type": "application/pdf" }),
    );
    await expect(
      fetchSafeUrl("https://example.com/file.pdf", {
        lookup: publicLookup,
        request,
      }),
    ).rejects.toMatchObject({ code: "SOURCE_CONTENT_UNSUPPORTED" });
  });

  it("normalizes timeout errors", async () => {
    const request = vi.fn<SafeRequest>(async () => {
      throw new TopicDomainError(
        "SOURCE_FETCH_TIMEOUT",
        "The source took too long to respond.",
      );
    });
    await expect(
      fetchSafeUrl("https://example.com", {
        lookup: publicLookup,
        request,
      }),
    ).rejects.toMatchObject({ code: "SOURCE_FETCH_TIMEOUT" });
  });

  it("stops after the redirect limit", async () => {
    const request = vi.fn<SafeRequest>(async (url) =>
      rawResponse(302, "", { location: `${url.origin}/again` }),
    );
    await expect(
      fetchSafeUrl("https://example.com/start", {
        lookup: publicLookup,
        request,
        limits: { maxRedirects: 2 },
      }),
    ).rejects.toThrow(/redirected too many times/);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
