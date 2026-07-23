import { describe, expect, it } from "vitest";
import {
  EXPECTED_AMAZON_AFFILIATE_TAG,
  affiliateUrlMatchesAmazonTarget,
  ensureAmazonAffiliateTag,
  rewriteAmazonAffiliateTagsInHtml,
} from "@/lib/cms/affiliate-parse";

describe("ensureAmazonAffiliateTag", () => {
  it("adds missing tag", () => {
    const result = ensureAmazonAffiliateTag("https://www.amazon.com/dp/B01MT0UL8N");
    expect(result.status).toBe("rewritten");
    if (result.status === "rewritten") {
      expect(result.url).toContain(`tag=${EXPECTED_AMAZON_AFFILIATE_TAG}`);
      expect(result.previousTag).toBeNull();
    }
  });

  it("replaces wrong tag", () => {
    const result = ensureAmazonAffiliateTag(
      "https://www.amazon.com/dp/B01MT0UL8N?tag=oldtag-20&ref=sr_1",
    );
    expect(result.status).toBe("rewritten");
    if (result.status === "rewritten") {
      expect(result.previousTag).toBe("oldtag-20");
      expect(result.url).toContain(`tag=${EXPECTED_AMAZON_AFFILIATE_TAG}`);
      expect(result.url).toContain("ref=sr_1");
      expect(result.url).not.toContain("oldtag-20");
    }
  });

  it("leaves correct tag unchanged", () => {
    const url = `https://www.amazon.com/dp/B01MT0UL8N?tag=${EXPECTED_AMAZON_AFFILIATE_TAG}`;
    expect(ensureAmazonAffiliateTag(url)).toEqual({ status: "unchanged", url });
  });

  it("skips amzn.to short links", () => {
    const url = "https://amzn.to/3abcXYZ";
    expect(ensureAmazonAffiliateTag(url)).toEqual({ status: "skipped_short_link", url });
  });

  it("preserves &amp; encoding style", () => {
    const result = ensureAmazonAffiliateTag(
      "https://www.amazon.com/dp/B01MT0UL8N?ref=sr_1&amp;keywords=gap",
    );
    expect(result.status).toBe("rewritten");
    if (result.status === "rewritten") {
      expect(result.url).toContain("&amp;");
      expect(result.url).toContain(`tag=${EXPECTED_AMAZON_AFFILIATE_TAG}`);
    }
  });
});

describe("rewriteAmazonAffiliateTagsInHtml", () => {
  it("rewrites missing and wrong tags in anchors", () => {
    const html = `
      <a href="https://www.amazon.com/dp/B01MT0UL8N">A</a>
      <a href="https://www.amazon.com/dp/B06Y2Q2RWW?tag=wrong-20">B</a>
      <a href="https://www.amazon.com/dp/B09NM549V7?tag=sls0fa-20">C</a>
      <a href="https://amzn.to/abc">D</a>
      <a href="/about/">E</a>
    `;
    const result = rewriteAmazonAffiliateTagsInHtml(html);
    expect(result.changedCount).toBe(2);
    expect(result.skippedShortLinks).toBe(1);
    expect(result.html).toContain("B01MT0UL8N?tag=sls0fa-20");
    expect(result.html).toContain("B06Y2Q2RWW?tag=sls0fa-20");
    expect(result.html).toContain("B09NM549V7?tag=sls0fa-20");
    expect(result.html).toContain("https://amzn.to/abc");
    expect(result.html).toContain('href="/about/"');
  });

  it("rewrites only matching URLs when a filter is provided", () => {
    const html = `
      <a href="https://www.amazon.com/dp/B01MT0UL8N">A</a>
      <a href="https://www.amazon.com/dp/B06Y2Q2RWW">B</a>
    `;
    const result = rewriteAmazonAffiliateTagsInHtml(html, EXPECTED_AMAZON_AFFILIATE_TAG, (href) =>
      affiliateUrlMatchesAmazonTarget(href, {
        asin: "B01MT0UL8N",
        normalizedUrl: "https://www.amazon.com/dp/B01MT0UL8N",
        url: "https://www.amazon.com/dp/B01MT0UL8N",
      }),
    );
    expect(result.changedCount).toBe(1);
    expect(result.html).toContain("B01MT0UL8N?tag=sls0fa-20");
    expect(result.html).toContain('href="https://www.amazon.com/dp/B06Y2Q2RWW"');
  });
});
