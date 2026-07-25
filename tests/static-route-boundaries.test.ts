import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRouteSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("public route boundaries", () => {
  it.each([
    "app/(site)/[...slug]/page.tsx",
    "app/(site)/category/[slug]/page.tsx",
    "app/(site)/author/[slug]/page.tsx",
  ])("allows on-demand params after CMS publish for %s", (relativePath) => {
    const source = readRouteSource(relativePath);

    expect(source).toContain("export const dynamicParams = true");
    expect(source).toContain("export async function generateStaticParams");
  });
});
