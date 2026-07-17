import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyShortcode,
  parseShortcodeTableId,
  reinjectProductDisplayMarkers,
  ShortcodeInventoryEntry,
} from "./product-display.js";

type CliArgs = {
  bundle?: string;
  shortcodes?: string;
  output?: string;
};

type UnknownShortcode = {
  postId: string;
  shortcode?: string;
};

type ContentBundle = {
  articles: Array<{ id: string; content: { html: string } }>;
  pages: Array<{ id: string; content: { html: string } }>;
  [key: string]: unknown;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.bundle || !args.shortcodes) {
    printUsageAndExit("Missing required --bundle or --shortcodes path.");
  }

  const bundlePath = resolve(args.bundle);
  const shortcodesPath = resolve(args.shortcodes);
  const outputPath = resolve(args.output ?? bundlePath);

  const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as ContentBundle;
  const shortcodes = JSON.parse(readFileSync(shortcodesPath, "utf8")) as UnknownShortcode[];
  const byPost = new Map<string, ShortcodeInventoryEntry[]>();

  for (const entry of shortcodes) {
    if (!entry.postId || !entry.shortcode) {
      continue;
    }
    const kind = classifyShortcode(entry.shortcode);
    const tableId =
      kind === "tablepress" || kind === "aawp" ? parseShortcodeTableId(entry.shortcode, kind) : undefined;
    const list = byPost.get(entry.postId) ?? [];
    list.push({
      postId: entry.postId,
      shortcode: entry.shortcode,
      kind,
      tableId,
    });
    byPost.set(entry.postId, list);
  }

  let articlesUpdated = 0;
  let markers = 0;

  for (const collection of [bundle.articles, bundle.pages]) {
    for (const item of collection) {
      const entries = byPost.get(item.id);
      if (!entries?.length) {
        continue;
      }
      const result = reinjectProductDisplayMarkers(item.content.html, entries);
      if (result.reinjected > 0) {
        item.content.html = result.html;
        articlesUpdated += 1;
        markers += result.reinjected;
      }
    }
  }

  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

  process.stdout.write(
    [
      "Product display marker reinjection complete.",
      `Articles/pages updated: ${articlesUpdated}`,
      `Markers reinjected: ${markers}`,
      `Output: ${outputPath}`,
      "",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bundle") {
      args.bundle = argv[++index];
    } else if (arg === "--shortcodes") {
      args.shortcodes = argv[++index];
    } else if (arg === "--out" || arg === "--output") {
      args.output = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      printUsageAndExit();
    } else {
      printUsageAndExit(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printUsageAndExit(error?: string): never {
  process.stderr.write(
    [
      error ? `Error: ${error}` : undefined,
      "Usage: node dist/src/reinject-product-displays-cli.js --bundle content/content-bundle.json --shortcodes formatted-content-output/reports/unknown-shortcodes.json [--out content/content-bundle.json]",
      "",
    ]
      .filter(Boolean)
      .join("\n") + "\n",
  );
  process.exit(error ? 1 : 0);
}

main();
