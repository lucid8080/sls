import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRouteSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("static route boundaries", () => {
  it.each([
    "app/(site)/[...slug]/page.tsx",
    "app/(site)/category/[slug]/page.tsx",
    "app/(site)/author/[slug]/page.tsx",
  ])("disables on-demand params for %s", (relativePath) => {
    const source = readRouteSource(relativePath);

    expect(source).toContain("export const dynamicParams = false");
    expect(source).toContain("export function generateStaticParams");
  });
});
