import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getContentBundle,
  getItemByPathname,
  getTrendingArticles,
  searchContent,
} from "@/lib/content";

describe("public content loader", () => {
  it("loads a reviewed home/lifestyle corpus", async () => {
    const bundle = await getContentBundle();

    expect(bundle.articles.length).toBeGreaterThan(100);
    expect(bundle.categories.map((category) => category.slug)).toContain("home-care");
    expect(bundle.categories.map((category) => category.slug)).toContain("smart-cleaning");
  });

  it("does not publish casino-style recovered spam routes", async () => {
    const bundle = await getContentBundle();

    expect(bundle.allPublicItems.some((item) => /casino|roulette|bingo|free-spins/i.test(item.pathname))).toBe(false);
    expect(await getItemByPathname("/american-roulette-and-european/")).toBeUndefined();
  });

  it("supports static local search over public articles", async () => {
    const results = await searchContent("robot vacuum");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain("robot");
  });

  it("keeps the search page free of server searchParams", () => {
    const source = readFileSync(new URL("../app/(site)/search/page.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("searchParams");
    expect(source).toContain("getSearchIndex");
    expect(source).toContain("SearchClient");
  });

  it("loads featured image data for public article cards and hero images", async () => {
    const article = await getItemByPathname("/7-ai-automations-that-save-me-10-hours-every-week/");

    expect(article?.featuredImage?.src).toMatch(/^\/media\/.+\.(webp|gif)$/);
    expect(article?.featuredImage?.width).toBeGreaterThan(0);
    expect(article?.featuredImage?.height).toBeGreaterThan(0);
    expect(article?.featuredImage?.variants?.card?.src).toMatch(/^\/media\/.+\.(webp|gif)$/);
  });

  it("builds a trending rail that excludes the current article", async () => {
    const article = (await getContentBundle()).articles[0];
    const trending = await getTrendingArticles(article, 5);

    expect(trending.length).toBeGreaterThan(0);
    expect(trending.length).toBeLessThanOrEqual(5);
    expect(trending.every((item) => item.id !== article.id)).toBe(true);
  });

  it("includes recovered product display markers on pilot articles", async () => {
    const luggage = await getItemByPathname(
      "/carry-on-luggage-rules-and-info-you-should-know-before-you-travel-baggage-chart-included/",
    );
    const makita = await getItemByPathname("/makita-robot-vacuum-review/");

    expect(luggage?.content.html).toContain('data-product-display="tablepress" data-id="5"');
    expect(makita?.content.html).toContain('data-product-display="aawp" data-id="4232"');
    expect(makita?.content.html).not.toContain("unsupported shortcode removed");
  });
});
