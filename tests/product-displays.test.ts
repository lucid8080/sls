import { describe, expect, it } from "vitest";
import { getAawpTable, getTablePressTable, splitProductDisplaySegments } from "@/lib/product-displays";

describe("product displays", () => {
  it("loads recovered AAWP comparison tables with affiliate tag", () => {
    const table = getAawpTable("4232");

    expect(table?.title).toMatch(/Makita/i);
    expect(table?.products.length).toBeGreaterThan(0);
    expect(table?.products[0]?.product?.url).toContain("tag=sls0fa-20");
    expect(table?.products[0]?.product?.url).not.toContain("AAWP_PLACEHOLDER");
    expect(table?.products[0]?.label).toBeTruthy();
  });

  it("loads recovered TablePress charts", () => {
    const table = getTablePressTable("5");

    expect(table?.rows.length).toBeGreaterThan(1);
    expect(table?.hasHeader).toBe(true);
  });

  it("splits article html around product display markers", () => {
    const segments = splitProductDisplaySegments(
      '<p>Before</p><figure data-product-display="tablepress" data-id="5" class="product-display-marker"></figure><p>After</p>',
    );

    expect(segments).toEqual([
      { type: "html", html: "<p>Before</p>" },
      { type: "tablepress", id: "5" },
      { type: "html", html: "<p>After</p>" },
    ]);
  });
});
