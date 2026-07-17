import { describe, expect, it } from "vitest";
import {
  enhanceArticleHtml,
  enhanceProductPicks,
  isProductPickHeading,
  parsePickTitle,
  wrapArticleTables,
} from "@/lib/article-enhance";

describe("article enhance", () => {
  it("wraps plain tables without forcing display:block", () => {
    const html = wrapArticleTables(
      "<h2>Quick Comparison Table</h2><table><thead><tr><th>Model</th><th>Suction</th></tr></thead><tbody><tr><td>A</td><td>1</td></td></tr></tbody></table>",
    );

    expect(html).toContain('class="article-table-scroll"');
    expect(html).toContain('class="article-table"');
    expect(html).not.toMatch(/display:\s*block/);
  });

  it("does not re-wrap product comparison or spec chart tables", () => {
    const html = wrapArticleTables(
      '<table class="spec-chart__table"><tr><th>A</th></tr></table><table class="product-comparison__table"><tr><td>B</td></tr></table>',
    );

    expect(html).not.toContain("article-table-scroll");
  });

  it("parses award-style product pick titles", () => {
    expect(parsePickTitle("1. Roborock S8 MaxV Ultra — Best Overall")).toEqual({
      productName: "Roborock S8 MaxV Ultra",
      badge: "Best Overall",
      monogram: "RS",
    });

    expect(parsePickTitle("Best Overall: Shark AI Ultra")).toEqual({
      productName: "Shark AI Ultra",
      badge: "Best Overall",
      monogram: "SA",
    });
  });

  it("detects product pick headings but leaves how-to steps alone without Amazon CTAs", () => {
    expect(isProductPickHeading("1. Roborock S8 MaxV Ultra — Best Overall")).toBe(true);
    expect(isProductPickHeading("1. Sweep or Vacuum")).toBe(true);

    const howTo = enhanceProductPicks(
      "<h3>1. Sweep or Vacuum</h3><p>Clean the floor first.</p><h3>2. Mop</h3><p>Then mop.</p>",
    );
    expect(howTo).not.toContain("product-pick");

    const picks = enhanceProductPicks(
      [
        "<h2>Our Top Picks for 2026</h2>",
        "<h3>1. Roborock S8 MaxV Ultra — Best Overall</h3>",
        "<p>Great for pets.</p>",
        '<p><a href="https://www.amazon.com/s?k=Roborock+S8+MaxV+Ultra&amp;tag=sls0fa-20">Check price</a></p>',
        "<h3>2. Shark AI Ultra — Best Budget Option</h3>",
        "<p>Budget pick.</p>",
        '<p><a href="https://www.amazon.com/s?k=Shark+AI+Ultra&amp;tag=sls0fa-20">Check price</a></p>',
        "<h2>What to Look For</h2>",
        "<p>Tips</p>",
      ].join(""),
    );

    expect(picks.match(/class="product-pick"/g)?.length).toBe(2);
    expect(picks).toContain("product-pick__badge");
    expect(picks).toContain("Roborock S8 MaxV Ultra");
    expect(picks).toContain("What to Look For");
  });

  it("enhances the pet-hair Top Picks article with cards and a wrapped comparison table", async () => {
    const { readFileSync } = await import("node:fs");
    const bundle = JSON.parse(readFileSync("content/content-bundle.json", "utf8")) as {
      articles: Array<{ slug: string; content: { html: string } }>;
    };
    const article = bundle.articles.find(
      (item) => item.slug === "best-robot-vacuums-for-pet-hair-in-2026-tested-and-ranked",
    );
    expect(article).toBeTruthy();

    const html = enhanceArticleHtml(article!.content.html);
    expect(html.match(/class="product-pick"/g)?.length).toBe(5);
    expect(html).toContain("article-table-scroll");
    expect(html).toContain("Quick Comparison Table");
    // At least Shark should resolve from recovered media.
    expect(html).toContain("product-pick__image");
  });

  it("enhances other 2026 product roundups that use award headings and Amazon CTAs", async () => {
    const { readFileSync } = await import("node:fs");
    const bundle = JSON.parse(readFileSync("content/content-bundle.json", "utf8")) as {
      articles: Array<{ slug: string; content: { html: string } }>;
    };
    const largeHomes = bundle.articles.find((item) => item.slug === "best-robot-vacuum-for-large-homes");
    const mostPowerful = bundle.articles.find(
      (item) => item.slug === "most-powerful-robot-vacuum-deep-clean-verified",
    );

    expect((enhanceArticleHtml(largeHomes!.content.html).match(/class="product-pick"/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((enhanceArticleHtml(mostPowerful!.content.html).match(/class="product-pick"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
