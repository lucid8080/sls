import { describe, expect, it, vi } from "vitest";
import {
  articleAiSuggestionSchema,
  articleSuggestionApplySchema,
  pickSelectedArticleSuggestions,
  sanitizeSuggestedArticleHtml,
} from "@/lib/cms/article-suggestions";
import { resolveSuggestedCategories, resolveSuggestedTags } from "@/lib/cms/article-suggestions/taxonomy";

vi.mock("@/lib/content", () => ({
  siteUrl: "https://simplelifesaver.com",
  getContentBundle: () => ({
    categories: [
      { id: "cat_kitchen", name: "Kitchen", slug: "kitchen" },
      { id: "cat_cleaning", name: "Cleaning", slug: "cleaning" },
    ],
    articles: [
      {
        tags: [{ id: "tag_tips", name: "Tips", slug: "tips" }],
      },
    ],
  }),
}));

describe("article AI suggestion schemas", () => {
  const valid = {
    title: "Better dishwasher cleaning habits for busy kitchens",
    excerpt: "Keep glasses clear with a weekly rinse routine.",
    seoTitle: "Dishwasher cleaning habits",
    seoDescription: "Practical weekly habits that prevent cloudy glasses.",
    categories: [{ id: "cat_kitchen", name: "Kitchen", slug: "kitchen" }],
    tags: [{ id: "tag_tips", name: "Tips", slug: "tips" }],
    html: "<p>Rinse filters weekly.</p>",
    rationale: "Clearer SEO and practical angle.",
  };

  it("accepts a complete suggestion payload", () => {
    expect(articleAiSuggestionSchema.parse(valid).title).toContain("dishwasher");
  });

  it("rejects forbidden workflow fields", () => {
    const result = articleAiSuggestionSchema.safeParse({
      ...valid,
      status: "published",
      slug: "hijacked",
    });
    expect(result.success).toBe(false);
  });

  it("requires selected fields for apply", () => {
    const parsed = articleSuggestionApplySchema.parse({
      expectedUpdatedAt: "2026-07-17T12:00:00.000Z",
      selectedFields: ["title", "excerpt"],
      suggestions: valid,
    });
    expect(parsed.selectedFields).toEqual(["title", "excerpt"]);
  });
});

describe("article suggestion helpers", () => {
  it("allowlists known categories and rejects unknown ones", () => {
    const known = {
      categories: [
        { id: "cat_kitchen", name: "Kitchen", slug: "kitchen" },
        { id: "cat_cleaning", name: "Cleaning", slug: "cleaning" },
      ],
      tagsBySlug: new Map([["tips", { id: "tag_tips", name: "Tips", slug: "tips" }]]),
    };

    expect(
      resolveSuggestedCategories([{ id: "x", name: "Kitchen", slug: "kitchen" }], known),
    ).toEqual([{ id: "cat_kitchen", name: "Kitchen", slug: "kitchen" }]);

    expect(() =>
      resolveSuggestedCategories([{ id: "x", name: "Gambling", slug: "gambling" }], known),
    ).toThrow(/Unknown category/);
  });

  it("normalizes tags to known or slugified terms", () => {
    const known = {
      categories: [],
      tagsBySlug: new Map([["tips", { id: "tag_tips", name: "Tips", slug: "tips" }]]),
    };

    expect(resolveSuggestedTags([{ id: "a", name: "Tips", slug: "tips" }], known)).toEqual([
      { id: "tag_tips", name: "Tips", slug: "tips" },
    ]);
    expect(resolveSuggestedTags([{ id: "b", name: "Hard Water", slug: "hard-water" }], known)).toEqual([
      { id: "b", name: "Hard Water", slug: "hard-water" },
    ]);
  });

  it("sanitizes suggested HTML before apply", () => {
    const sanitized = sanitizeSuggestedArticleHtml(
      '<p>Safe</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      { id: "cms_test", title: "Test", pathname: "/test/" },
    );
    expect(sanitized).toContain("<p>Safe</p>");
    expect(sanitized.toLowerCase()).not.toContain("<script");
    expect(sanitized.toLowerCase()).not.toContain("javascript:");
  });

  it("picks only selected fields", () => {
    const picked = pickSelectedArticleSuggestions(
      {
        title: "Title",
        excerpt: "Excerpt",
        html: "<p>Body</p>",
      },
      ["title", "html"],
    );
    expect(picked).toEqual({
      title: "Title",
      html: "<p>Body</p>",
    });
  });
});
