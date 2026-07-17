import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { listPublishedArticles } from "@/lib/cms/articles";
import { articleRowToExport } from "@/lib/cms/validate";
import { CmsExportBundleSchema } from "@/lib/cms/schemas";

export async function exportCmsBundle(outputPath?: string): Promise<{ path: string; count: number }> {
  const target = outputPath ?? join(process.cwd(), "content", "cms-export.json");

  if (!isDatabaseConfigured()) {
    writeEmptyExport(target);
    return { path: target, count: 0 };
  }

  try {
    const rows = await listPublishedArticles();
    const articles = rows.map(articleRowToExport);
    const bundle = CmsExportBundleSchema.parse({
      generatedAt: new Date().toISOString(),
      articles,
    });

    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    return { path: target, count: articles.length };
  } catch {
    writeEmptyExport(target);
    return { path: target, count: 0 };
  }
}

function writeEmptyExport(target: string): void {
  const dir = join(target, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const bundle = {
    generatedAt: new Date().toISOString(),
    articles: [],
  };
  writeFileSync(target, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}
