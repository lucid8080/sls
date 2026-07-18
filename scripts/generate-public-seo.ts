import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPublicSeoArtifacts } from "../lib/seo/public-artifacts";

const root = process.cwd();
const publicDir = join(root, "public");
const artifacts = buildPublicSeoArtifacts();

mkdirSync(publicDir, { recursive: true });

const targets = [
  ["sitemap.xml", artifacts.sitemapXml],
  ["robots.txt", artifacts.robotsTxt],
  ["rss.xml", artifacts.rssXml],
] as const;

for (const [filename, contents] of targets) {
  writeFileSync(join(root, filename), contents, "utf8");
  writeFileSync(join(publicDir, filename), contents, "utf8");
}

console.log(
  `[generate-public-seo] Wrote sitemap.xml, robots.txt, and rss.xml from the public content filter.`,
);
