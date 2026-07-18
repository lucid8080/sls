import { describe, expect, it } from "vitest";
import { detectSourcePlatform } from "@/lib/integrations/source-extraction/detect-platform";
import { normalizeSourceUrl } from "@/lib/integrations/source-extraction/normalize-source-url";

describe("source URL normalization", () => {
  it("removes tracking parameters and fragments while preserving meaningful query data", () => {
    expect(
      normalizeSourceUrl(
        "https://EXAMPLE.com:443/article?product=robot&utm_source=newsletter&fbclid=abc#details",
      ),
    ).toBe("https://example.com/article?product=robot");
  });

  it("removes default HTTP ports", () => {
    expect(normalizeSourceUrl("http://Example.COM:80/path")).toBe(
      "http://example.com/path",
    );
  });

  it.each([
    [
      "https://youtu.be/dQw4w9WgXcQ?t=30&utm_campaign=test",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    ],
    [
      "https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share",
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&utm_medium=social",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123",
    ],
  ])("normalizes YouTube variant %s", (input, expected) => {
    expect(normalizeSourceUrl(input)).toBe(expected);
  });

  it("normalizes Twitter hosts to X while preserving the post ID", () => {
    expect(
      normalizeSourceUrl(
        "https://mobile.twitter.com/example/status/1234567890?utm_source=share",
      ),
    ).toBe("https://x.com/example/status/1234567890");
  });

  it("preserves meaningful TikTok paths and query parameters", () => {
    expect(
      normalizeSourceUrl(
        "https://www.tiktok.com/@creator/video/123456?_r=1&utm_content=share",
      ),
    ).toBe("https://www.tiktok.com/@creator/video/123456?_r=1");
  });
});

describe("source platform detection", () => {
  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    ["https://x.com/example/status/1", "x"],
    ["https://twitter.com/example/status/1", "twitter"],
    ["https://www.instagram.com/p/abc/", "instagram"],
    ["https://www.tiktok.com/@creator/video/1", "tiktok"],
    ["https://reddit.com/r/home/comments/1", "reddit"],
    ["https://linkedin.com/posts/example", "linkedin"],
    ["https://facebook.com/example/posts/1", "facebook"],
    ["https://threads.net/@example/post/1", "threads"],
    ["https://example.com/article", "generic_web"],
  ])("detects %s as %s", (url, expected) => {
    expect(detectSourcePlatform(url)).toBe(expected);
  });
});
