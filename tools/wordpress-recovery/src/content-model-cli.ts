import { resolve } from "node:path";
import { buildContentBundle, readJsonFile, writeContentBundle } from "./content-model.js";

type CliArgs = {
  content?: string;
  seo?: string;
  routes?: string;
  media?: string;
  output?: string;
  includeNoindex?: boolean;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.content || !args.seo || !args.routes || !args.output) {
    printUsageAndExit("Missing required --content, --seo, --routes, or --out argument.");
  }

  const bundle = buildContentBundle(
    readJsonFile(resolve(args.content)),
    readJsonFile(resolve(args.seo)),
    readJsonFile(resolve(args.routes)),
    {
      includeNoindex: args.includeNoindex,
      mediaAccepted: args.media ? readJsonFile(resolve(args.media)) : undefined,
    },
  );
  const summary = writeContentBundle(resolve(args.output), bundle);

  process.stdout.write(
    [
      "Content model generation complete.",
      `Articles: ${summary.articles}`,
      `Pages: ${summary.pages}`,
      `Authors: ${summary.authors}`,
      `Categories: ${summary.categories}`,
      `Tags: ${summary.tags}`,
      `Routes: ${summary.routes}`,
      `Excluded content: ${summary.excludedContent}`,
      `Validation warnings: ${summary.validationWarnings}`,
      `Output: ${resolve(args.output)}`,
      "",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--content") {
      args.content = argv[++index];
    } else if (arg === "--seo") {
      args.seo = argv[++index];
    } else if (arg === "--routes") {
      args.routes = argv[++index];
    } else if (arg === "--media") {
      args.media = argv[++index];
    } else if (arg === "--out" || arg === "--output") {
      args.output = argv[++index];
    } else if (arg === "--include-noindex") {
      args.includeNoindex = true;
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
    "Usage: node dist/src/content-model-cli.js --content data/linked-content.json --seo data/seo-metadata.json --routes data/route-manifest.json --media recovered-media-output/reports/media-accepted.json --out content",
    "",
    "This utility validates controlled recovery artifacts and writes file-based production content JSON.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
