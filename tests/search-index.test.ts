import { describe, expect, it } from "vitest";
import { searchIndex } from "@/lib/search-index";
import { getSearchIndex, searchPublicContent } from "@/lib/search-index-server";

describe("compact public search index", () => {
  it("indexes metadata without requiring article HTML at query time", () => {
    const index = getSearchIndex();
    expect(index.length).toBeGreaterThan(100);
    expect(index[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      pathname: expect.any(String),
      haystack: expect.any(String),
      readingMinutes: expect.any(Number),
    });
    expect("content" in index[0]).toBe(false);
  });

  it("finds articles by title or category text", () => {
    const results = searchPublicContent("robot vacuum");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain("robot");
    expect(searchIndex("robot vacuum", getSearchIndex()).length).toBe(results.length);
  });
});
