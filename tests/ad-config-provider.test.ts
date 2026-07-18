import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AdConfigProvider static config path", () => {
  it("skips the browser fetch when layout already supplied initialConfig", () => {
    const source = readFileSync(
      join(process.cwd(), "components/ads/AdConfigProvider.tsx"),
      "utf8",
    );

    expect(source).toContain("if (initialConfig)");
    expect(source).toContain("Skip the redundant CDN round-trip");
    expect(source).toMatch(/fetch\("\/api\/ads\/config"\)/);
  });
});
