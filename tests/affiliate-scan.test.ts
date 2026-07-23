import { describe, expect, it } from "vitest";
import {
  EXPECTED_AMAZON_AFFILIATE_TAG,
  computeTagStatus,
  extractAffiliateLinksFromHtml,
  extractAsin,
  extractAffiliateTag,
  normalizeAffiliateUrl,
  parseAffiliateHref,
} from "@/lib/cms/affiliate-parse";

describe("affiliate-parse", () => {
  it("extracts ASIN from /dp/ and /gp/product/ paths", () => {
    expect(extractAsin("https://www.amazon.com/dp/B01MT0UL8N?tag=sls0fa-20")).toBe("B01MT0UL8N");
    expect(extractAsin("https://www.amazon.com/gp/product/B06Y2Q2RWW/ref=abc")).toBe("B06Y2Q2RWW");
  });

  it("extracts affiliate tag from query string", () => {
    expect(extractAffiliateTag("https://www.amazon.com/dp/B01MT0UL8N?tag=sls0fa-20")).toBe(
      EXPECTED_AMAZON_AFFILIATE_TAG,
    );
    expect(extractAffiliateTag("https://www.amazon.com/dp/B01MT0UL8N")).toBeNull();
  });

  it("computes tag status for Amazon vs other networks", () => {
    expect(computeTagStatus("amazon", "sls0fa-20")).toBe("ok");
    expect(computeTagStatus("amazon", "wrong-tag")).toBe("missing_tag");
    expect(computeTagStatus("amazon", null)).toBe("missing_tag");
    expect(computeTagStatus("other", null)).toBe("not_applicable");
  });

  it("normalizes Amazon product URLs for dedupe", () => {
    const a = normalizeAffiliateUrl(
      "https://www.amazon.com/Lindas-Silicone/dp/B01MT0UL8N/ref=sr_1_4?keywords=gap&tag=sls0fa-20&qid=1",
    );
    expect(a).toMatchObject({
      network: "amazon",
      asin: "B01MT0UL8N",
      affiliateTag: "sls0fa-20",
      tagStatus: "ok",
      normalizedUrl: "https://www.amazon.com/dp/B01MT0UL8N",
    });

    const b = normalizeAffiliateUrl("https://amazon.com/dp/B01MT0UL8N");
    expect(b?.normalizedUrl).toBe("https://www.amazon.com/dp/B01MT0UL8N");
    expect(b?.tagStatus).toBe("missing_tag");
  });

  it("recognizes amzn.to and ShareASale links", () => {
    expect(parseAffiliateHref("https://amzn.to/3abcXYZ")?.network).toBe("amazon");
    expect(
      parseAffiliateHref("https://shareasale.com/r.cfm?b=1633857&u=2856044&m=94971")?.network,
    ).toBe("other");
    expect(parseAffiliateHref("/internal-post/") ).toBeNull();
  });

  it("extracts affiliate links from HTML and ignores internal links", () => {
    const html = `
      <p><a href="/about/">About</a></p>
      <p><a href="https://www.amazon.com/dp/B06Y2Q2RWW?tag=sls0fa-20"><strong>Buy Makita</strong></a></p>
      <p><a href="https://www.amazon.co.uk/dp/B01MT0UL8N">UK listing</a></p>
      <p><a href="https://shareasale.com/r.cfm?b=1&u=2&m=3">Neato parts</a></p>
    `;

    const links = extractAffiliateLinksFromHtml(html);
    expect(links).toHaveLength(3);

    const amazon = links.find((link) => link.asin === "B06Y2Q2RWW");
    expect(amazon).toMatchObject({
      network: "amazon",
      tagStatus: "ok",
      anchorText: "Buy Makita",
    });

    const missingTag = links.find((link) => link.asin === "B01MT0UL8N");
    expect(missingTag?.tagStatus).toBe("missing_tag");

    const other = links.find((link) => link.network === "other");
    expect(other?.tagStatus).toBe("not_applicable");
  });

  it("decodes &amp; in hrefs", () => {
    const parsed = parseAffiliateHref(
      "https://www.amazon.com/dp/B01MT0UL8N?tag=sls0fa-20&amp;ref=abc",
    );
    expect(parsed?.affiliateTag).toBe("sls0fa-20");
    expect(parsed?.asin).toBe("B01MT0UL8N");
  });
});
