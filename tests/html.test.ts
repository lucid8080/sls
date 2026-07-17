import { describe, expect, it } from "vitest";
import {
  normalizeArticleHtmlEntities,
  normalizeDoubleEncodedAmps,
  normalizeNbspEntities,
} from "@/lib/html";

describe("normalizeNbspEntities", () => {
  it("converts nbsp variants to regular spaces", () => {
    expect(normalizeNbspEntities("The&nbsp;Whirlpool&amp;nbsp;costs $&#160;549.")).toBe(
      "The Whirlpool costs $ 549.",
    );
    expect(normalizeNbspEntities("a\u00a0b")).toBe("a b");
  });
});

describe("normalizeDoubleEncodedAmps", () => {
  it("collapses double-encoded ampersands to a single entity", () => {
    expect(normalizeDoubleEncodedAmps("Wash &amp;amp; Inspect")).toBe("Wash &amp; Inspect");
    expect(normalizeDoubleEncodedAmps("A &amp;amp;amp; B")).toBe("A &amp; B");
  });

  it("leaves correctly encoded ampersands alone", () => {
    expect(normalizeDoubleEncodedAmps("Tom &amp; Jerry")).toBe("Tom &amp; Jerry");
  });

  it("fixes double-encoded query strings in hrefs", () => {
    expect(
      normalizeDoubleEncodedAmps('href="https://example.com/?a=1&amp;amp;b=2"'),
    ).toBe('href="https://example.com/?a=1&amp;b=2"');
  });
});

describe("normalizeArticleHtmlEntities", () => {
  it("applies nbsp and amp normalization together", () => {
    expect(
      normalizeArticleHtmlEntities("Salmon&amp;nbsp;&amp;amp; Asparagus"),
    ).toBe("Salmon &amp; Asparagus");
  });
});
