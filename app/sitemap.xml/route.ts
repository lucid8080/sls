import { readFileSync } from "node:fs";
import { join } from "node:path";

export function GET() {
  const xml = readFileSync(join(process.cwd(), "sitemap.xml"), "utf8");
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
}
