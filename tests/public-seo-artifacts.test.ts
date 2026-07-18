import { describe, expect, it } from "vitest";
import { getContentBundle } from "@/lib/content";
import { buildPublicSeoArtifacts } from "@/lib/seo/public-artifacts";

const BLOCKED_RE =
  /\b(casino|pokies?|slots?|blackjack|gambling|roulette|bingo|free spins?|no deposit|real cash|wagering|jackpot|betting)\b/i;

describe("public SEO artifacts", () => {
  it("builds sitemap and RSS only from the public content filter", () => {
    const bundle = getContentBundle();
    const artifacts = buildPublicSeoArtifacts(bundle);

    expect(artifacts.sitemapXml).toContain("<urlset");
    expect(artifacts.sitemapXml).toContain("https://simplelifesaver.com/");
    expect(artifacts.robotsTxt).toContain("Sitemap: https://simplelifesaver.com/sitemap.xml");

    for (const item of bundle.allPublicItems.slice(0, 20)) {
      expect(artifacts.sitemapXml).toContain(item.pathname.replace(/\/$/, "") || "/");
    }

    expect(artifacts.rssXml).toContain("<rss version=\"2.0\">");
    expect(artifacts.rssXml).not.toMatch(BLOCKED_RE);
    expect(artifacts.sitemapXml).not.toMatch(BLOCKED_RE);

    const firstArticle = bundle.articles[0];
    expect(artifacts.rssXml).toContain(firstArticle.title);
  });

  it("never advertises known blocked recovered spam paths", () => {
    const artifacts = buildPublicSeoArtifacts();

    expect(artifacts.sitemapXml).not.toContain("/american-roulette-and-european/");
    expect(artifacts.rssXml).not.toContain("/best-online-bookies/");
    expect(artifacts.rssXml).not.toContain("Best Online Bookies");
  });
});
