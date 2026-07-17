import { resolve } from "node:path";
import { readSanitizedArticles } from "./route.js";
import { buildSeoOutput, readRouteManifest, writeSeoOutput, writeSeoOutputToProject } from "./seo.js";
import { parseWordPressDump } from "./sql.js";

type CliArgs = {
  sql?: string;
  content?: string;
  routes?: string;
  output?: string;
  projectRoot?: string;
  prefix?: string;
  siteUrl?: string;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.sql || !args.content || !args.routes || !args.siteUrl) {
    printUsageAndExit("Missing required --sql, --content, --routes, or --site-url argument.");
  }

  const dump = parseWordPressDump(resolve(args.sql), { prefix: args.prefix });
  const articles = readSanitizedArticles(resolve(args.content));
  const routes = readRouteManifest(resolve(args.routes));
  const output = buildSeoOutput(dump, articles, routes, { siteUrl: args.siteUrl });

  if (args.output) {
    writeSeoOutput(resolve(args.output), output);
  }

  if (args.projectRoot) {
    writeSeoOutputToProject(resolve(args.projectRoot), output);
  }

  process.stdout.write(
    [
      "SEO metadata generation complete.",
      `Metadata entries: ${output.metadata.length}`,
      `Review entries: ${output.review.length}`,
      `Indexable sitemap URLs: ${output.metadata.filter((entry) => !entry.noindex).length}`,
      args.output ? `Output: ${resolve(args.output)}` : undefined,
      args.projectRoot ? `Project root: ${resolve(args.projectRoot)}` : undefined,
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--sql") {
      args.sql = argv[++index];
    } else if (arg === "--content") {
      args.content = argv[++index];
    } else if (arg === "--routes") {
      args.routes = argv[++index];
    } else if (arg === "--out" || arg === "--output") {
      args.output = argv[++index];
    } else if (arg === "--project-root") {
      args.projectRoot = argv[++index];
    } else if (arg === "--prefix") {
      args.prefix = argv[++index];
    } else if (arg === "--site-url") {
      args.siteUrl = argv[++index];
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
    "Usage: node dist/src/seo-cli.js --sql dump.sql --content formatted-content-output/sanitized-content.json --routes data/route-manifest.json --site-url https://example.com [--out seo-output] [--project-root path] [--prefix r14_]",
    "",
    "This utility recovers and sanitizes SEO metadata from approved SQL tables and safe content artifacts.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
