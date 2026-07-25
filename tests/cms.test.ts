import { describe, expect, it } from "vitest";
import {
  featuredImageFromMediaAsset,
  normalizeFeaturedImage,
  toPublicMediaPath,
} from "@/lib/cms/featured-image";
import { jsonError } from "@/lib/cms/http";
import { formatPublishGateError } from "@/lib/cms/publish-messages";
import { sanitizeCmsHtml } from "@/lib/cms/sanitize";
import { pathnameFromSlug, slugifyTitle } from "@/lib/cms/schemas";
import { articleRowToExport, runQualityGates, validatePublishedArticle } from "@/lib/cms/validate";
import type { ArticleRow } from "@/lib/cms/db/schema";

describe("cms sanitize", () => {
  it("removes script tags from html", () => {
    const result = sanitizeCmsHtml("<p>Hello</p><script>alert(1)</script>");
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
  it("does not enforce a minimum word count", async () => {
    const result = await runQualityGates({
      id: "cms_test",
      type: "article",
      title: "Test",
      slug: "test",
      pathname: "/test/",
      status: "published",
      publishedAt: new Date().toISOString(),
      categories: [{ id: "1", name: "Blog", slug: "blog" }],
      tags: [],
      content: { kind: "html", html: "<h2>Overview</h2><p>short</p>" },
      seo: { canonicalPath: "/test/", noindex: false },
    });

    expect(result.issues.some((issue) => issue.code === "min_word_count")).toBe(false);
    expect(result.passed).toBe(true);
  });

  it("fails publish on missing H2 but treats FAQ as warning only", async () => {
    const result = await runQualityGates({
      id: "cms_test_h2",
      type: "article",
      title: "Test Guide",
      slug: "test-guide",
      pathname: "/test-guide/",
      status: "published",
      publishedAt: new Date().toISOString(),
      categories: [{ id: "1", name: "Blog", slug: "blog" }],
      tags: [],
      content: {
        kind: "html",
        html: "<p>A short article body without an h2 heading.</p><h3>Details</h3>",
      },
      seo: { canonicalPath: "/test-guide/", noindex: false },
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.code === "require_h2" && issue.severity === "error")).toBe(
      true,
    );
    expect(result.issues.some((issue) => issue.code === "require_faq" && issue.severity === "warning")).toBe(
      true,
    );
  });

  it("passes when H2 is present even without FAQ", async () => {
    const result = await runQualityGates({
      id: "cms_test_ok",
      type: "article",
      title: "Test Guide",
      slug: "test-guide",
      pathname: "/test-guide/",
      status: "published",
      publishedAt: new Date().toISOString(),
      categories: [{ id: "1", name: "Blog", slug: "blog" }],
      tags: [],
      content: {
        kind: "html",
        html: `<h2>Overview</h2><p>Enough body copy for a short guide.</p><p><a href="/other-guide/">Related</a> <a href="/tips/">Tips</a> <a href="/care/">Care</a></p>`,
      },
      seo: { canonicalPath: "/test-guide/", noindex: false },
    });

    expect(result.passed).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(false);
    expect(result.issues.some((issue) => issue.code === "require_faq")).toBe(true);
  });
});

describe("publish gate error payload", () => {
  it("jsonError includes optional issues for publish failures", async () => {
    const issues = [
      {
        code: "require_h2",
        message: "Article must include at least one H2 heading.",
        severity: "error",
      },
    ];
    const response = jsonError("Quality gates failed.", 422, { issues });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Quality gates failed.",
      issues,
    });
  });

  it("formatPublishGateError prefers error-severity messages", () => {
    const message = formatPublishGateError("Quality gates failed.", [
      {
        code: "require_faq",
        message: "Article should include a FAQ section.",
        severity: "warning",
      },
      {
        code: "require_h2",
        message: "Article must include at least one H2 heading.",
        severity: "error",
      },
    ]);

    expect(message).toContain("Quality gates failed.");
    expect(message).toContain("Article must include at least one H2 heading.");
    expect(message).not.toContain("FAQ");
  });
});

describe("featured image normalization", () => {
  it("converts absolute media URL strings into featured image objects", () => {
    expect(
      toPublicMediaPath(
        "https://www.simplelifesaver.com/media/2020/01/Webp.net-compress-image-scaled.webp",
      ),
    ).toBe("/media/2020/01/Webp.net-compress-image-scaled.webp");

    const image = normalizeFeaturedImage(
      "https://www.simplelifesaver.com/media/2020/01/Webp.net-compress-image-scaled.webp",
    );
    expect(image).toEqual({
      src: "/media/2020/01/Webp.net-compress-image-scaled.webp",
      alt: "",
      width: 1200,
      height: 800,
    });
  });

  it("lets publish validation pass when featuredImage was stored as a string URL", async () => {
    const words = Array.from({ length: 320 }, () => "word").join(" ");
    const row = {
      id: "cms_featured_string",
      title: "Cable Tray Guide",
      slug: "cable-tray-guide",
      pathname: "/cable-tray-guide/",
      status: "published",
      excerpt: null,
      html: `<h2>Overview</h2><p>${words}</p>`,
      author: null,
      categories: [{ id: "1", name: "Home Care", slug: "home-care" }],
      tags: [],
      featuredImage: "https://www.simplelifesaver.com/media/2020/01/Webp.net-compress-image-scaled.webp",
      seo: { canonicalPath: "/cable-tray-guide/", noindex: false },
      publishedAt: new Date(),
      modifiedAt: new Date(),
      scheduledAt: null,
      createdBy: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as ArticleRow;

    const exported = articleRowToExport(row);
    expect(exported.featuredImage?.src).toBe("/media/2020/01/Webp.net-compress-image-scaled.webp");

    const validation = await validatePublishedArticle(exported);
    expect(validation.ok).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "schema_validation")).toBe(false);
  });

  it("maps media assets into featured images with parsed dimensions", () => {
    expect(
      featuredImageFromMediaAsset({
        publicPath: "/media/2024/06/hero.webp",
        alt: "Cable tray",
        width: "1600",
        height: "900",
      }),
    ).toEqual({
      src: "/media/2024/06/hero.webp",
      alt: "Cable tray",
      width: 1600,
      height: 900,
    });

    expect(
      featuredImageFromMediaAsset({
        publicPath: "/media/2024/06/hero.webp",
        alt: null,
        width: null,
        height: null,
      }),
    ).toEqual({
      src: "/media/2024/06/hero.webp",
      alt: "",
      width: 1200,
      height: 800,
    });

    expect(featuredImageFromMediaAsset({ publicPath: "https://cdn.example/not-media.jpg" })).toBeUndefined();
  });
});
