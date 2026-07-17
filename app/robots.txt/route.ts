import { readFileSync } from "node:fs";
import { join } from "node:path";

export function GET() {
  const text = readFileSync(join(process.cwd(), "robots.txt"), "utf8");
  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
