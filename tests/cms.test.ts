import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { pathnameFromSlug, slugifyTitle } from "@/lib/cms/schemas";
import { runQualityGates } from "@/lib/cms/validate";

describe("cms sanitize", () => {
  it("removes script tags from html", () => {
    const result = sanitizeCmsHtml('<p>Hello</p><script>alert(1)</script>');
    expect(result.html).toBe("<p>Hello</p>");
    expect(result.reports.some((report) => report.severity === "high")).toBe(true);
  });
});

describe("cms schemas", () => {
  it("slugifies titles", () => {
    expect(slugifyTitle("Instant Pot Tips & Tricks!")).toBe("instant-pot-tips-tricks");
    expect(pathnameFromSlug("instant-pot-tips-tricks")).toBe("/instant-pot-tips-tricks/");
  });
});

describe("cms quality gates", () => {
  it("flags short articles", () => {
    const result = runQualityGates({
      id: "cms_test",
      type: "article",
      title: "Test",
      slug: "test",
      pathname: "/test/",
      status: "published",
      publishedAt: new Date().toISOString(),
      categories: [{ id: "1", name: "Blog", slug: "blog" }],
      tags: [],
      content: { kind: "html", html: "<p>short</p>" },
      seo: { canonicalPath: "/test/", noindex: false },
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.code === "min_word_count")).toBe(true);
  });
});
