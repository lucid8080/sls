import { describe, expect, it } from "vitest";
import {
  combineAdminArticles,
  recoveredArticleToAdminArticle,
  type AdminArticle,
} from "@/lib/cms/admin-articles";
import { getRecoveredContentBundle, type ContentItem } from "@/lib/content";

function recoveredArticle(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "101",
    type: "article",
    title: "Recovered guide",
    slug: "recovered-guide",
    pathname: "/recovered-guide/",
    status: "published",
    excerpt: "Recovered excerpt",
    publishedAt: "2025-01-01T00:00:00.000Z",
    modifiedAt: "2025-02-01T00:00:00.000Z",
    categories: [],
    tags: [],
    content: { kind: "html", html: "<p>Recovered body</p>" },
    seo: { canonicalPath: "/recovered-guide/", noindex: false },
    ...overrides,
  };
}

function databaseArticle(overrides: Partial<AdminArticle> = {}): AdminArticle {
  return {
    id: "cms_1",
    title: "Database draft",
    slug: "database-draft",
    pathname: "/database-draft/",
    status: "draft",
    excerpt: null,
    html: "<p>Database body</p>",
    author: null,
    categories: [],
    tags: [],
    featuredImage: null,
    seo: { canonicalPath: "/database-draft/", noindex: true },
    publishedAt: null,
    modifiedAt: "2025-03-01T00:00:00.000Z",
    scheduledAt: null,
    createdAt: "2025-03-01T00:00:00.000Z",
    updatedAt: "2025-03-01T00:00:00.000Z",
    source: "database",
    ...overrides,
  };
}

describe("combined admin articles", () => {
  it("exposes the full recovered catalog when the database has no overrides", () => {
    const result = combineAdminArticles([], getRecoveredContentBundle().articles);

    expect(result.length).toBeGreaterThan(500);
    expect(result.every((article) => article.source === "recovered")).toBe(true);
  });

  it("maps recovered content into the existing editor shape", () => {
    const article = recoveredArticleToAdminArticle(recoveredArticle());

    expect(article).toMatchObject({
      id: "101",
      status: "published",
      html: "<p>Recovered body</p>",
      source: "recovered",
      updatedAt: "2025-02-01T00:00:00.000Z",
    });
  });

  it("combines both sources and lets database overrides win by ID", () => {
    const recovered = [
      recoveredArticle(),
      recoveredArticle({ id: "102", title: "Second recovered", slug: "second", pathname: "/second/" }),
    ];
    const override = databaseArticle({
      id: "101",
      title: "Edited recovered guide",
      slug: "recovered-guide",
      pathname: "/recovered-guide/",
      status: "archived",
    });

    const result = combineAdminArticles([override], recovered);

    expect(result).toHaveLength(2);
    expect(result.find((article) => article.id === "101")).toMatchObject({
      title: "Edited recovered guide",
      status: "archived",
      source: "database",
    });
  });

  it("applies status and title-or-slug search after deduplication", () => {
    const recovered = [
      recoveredArticle(),
      recoveredArticle({
        id: "102",
        title: "Air Fryer Guide",
        slug: "family-air-fryer",
        pathname: "/family-air-fryer/",
      }),
    ];
    const archivedOverride = databaseArticle({
      id: "102",
      title: "Archived Air Fryer Guide",
      slug: "family-air-fryer",
      pathname: "/family-air-fryer/",
      status: "archived",
    });

    expect(combineAdminArticles([archivedOverride], recovered, { status: "published" })).toHaveLength(1);
    expect(combineAdminArticles([archivedOverride], recovered, { status: "archived", search: "air fryer" })).toEqual([
      archivedOverride,
    ]);
    expect(combineAdminArticles([archivedOverride], recovered, { search: "family-air" })).toEqual([
      archivedOverride,
    ]);
  });
});
