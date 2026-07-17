import { resolve } from "node:path";
import {
  extractProductDisplays,
  PRODUCT_DISPLAY_EXTRA_TABLES,
  writeProductDisplays,
} from "./product-display.js";
import { parseWordPressDump } from "./sql.js";

type CliArgs = {
  input?: string;
  output?: string;
  data?: string;
  prefix?: string;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    printUsageAndExit("Missing required --input path.");
  }

  const input = resolve(args.input);
  const output = resolve(args.output ?? "product-display-output");
  const dataDir = resolve(args.data ?? "data");
  const dump = parseWordPressDump(input, {
    prefix: args.prefix,
    extraTableSuffixes: [...PRODUCT_DISPLAY_EXTRA_TABLES],
  });
  const bundle = extractProductDisplays(dump);
  writeProductDisplays(output, dataDir, bundle);

  process.stdout.write(
    [
      "Product display extraction complete.",
      `Input: ${input}`,
      `Output: ${output}`,
      `Data dir: ${dataDir}`,
      `TablePress tables: ${bundle.summary.tablepressTables}`,
      `AAWP tables: ${bundle.summary.aawpTables}`,
      `AAWP products: ${bundle.summary.aawpProducts}`,
      `Pretty Links: ${bundle.summary.prettyLinks}`,
      `Article references: ${bundle.summary.references}`,
      "Note: AAWP API credentials are never extracted.",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input") {
      args.input = argv[++index];
    } else if (arg === "--out" || arg === "--output") {
      args.output = argv[++index];
    } else if (arg === "--data") {
      args.data = argv[++index];
    } else if (arg === "--prefix") {
      args.prefix = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      printUsageAndExit();
    } else {
      printUsageAndExit(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printUsageAndExit(error?: string): never {
  const message = [
    error ? `Error: ${error}` : undefined,
    "Usage: node dist/src/product-display-cli.js --input <dump.sql> [--out <dir>] [--data data] [--prefix r14_]",
    "",
    "Extracts TablePress charts, AAWP comparison tables/products, and Pretty Link mappings.",
    "Does not extract Amazon API keys or other secrets from plugin options.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
