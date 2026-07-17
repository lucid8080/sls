import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  if (!process.env.DATABASE_URL) {
    const target = join(root, "content", "cms-export.json");
    writeFileSync(
      target,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), articles: [] }, null, 2)}\n`,
      "utf8",
    );
    console.log("DATABASE_URL not set; wrote empty cms-export.json");
    return;
  }

  const { exportCmsBundle } = await import("../lib/cms/export.ts");
  const result = await exportCmsBundle();
  console.log(`Exported ${result.count} CMS article(s) to ${result.path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
