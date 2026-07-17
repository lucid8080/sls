import { exportCmsBundle } from "@/lib/cms/export";

async function main() {
  const result = await exportCmsBundle();
  console.log(`Exported ${result.count} CMS article(s) to ${result.path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
