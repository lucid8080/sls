import { readFileSync } from "node:fs";
import { join } from "node:path";

export function GET() {
  const xml = readFileSync(join(process.cwd(), "rss.xml"), "utf8");
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
}
