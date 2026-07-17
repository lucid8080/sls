import { resolve } from "node:path";
import { readRouteManifest } from "./seo.js";
import { readArticles, rewriteInternalLinks, writeLinkOutput, writeLinkOutputToProject } from "./link.js";

type CliArgs = {
  content?: string;
  routes?: string;
  output?: string;
  projectRoot?: string;
  siteUrl?: string;
  mediaPrefix?: string;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.content || !args.routes || !args.siteUrl) {
    printUsageAndExit("Missing required --content, --routes, or --site-url argument.");
  }

  const articles = readArticles(resolve(args.content));
  const routes = readRouteManifest(resolve(args.routes));
  const result = rewriteInternalLinks(articles, routes, {
    siteUrl: args.siteUrl,
    mediaPrefix: args.mediaPrefix,
  });

  if (args.output) {
    writeLinkOutput(resolve(args.output), result);
  }

  if (args.projectRoot) {
    writeLinkOutputToProject(resolve(args.projectRoot), result);
  }

  process.stdout.write(
    [
      "Internal link rewrite complete.",
      `Articles: ${result.content.length}`,
      `Rewritten internal/media links: ${result.summary.rewrittenInternalLinks}`,
      `Preserved external links: ${result.summary.preservedExternalLinks}`,
      `Broken internal links: ${result.summary.brokenInternalLinks}`,
      `Suspicious external links: ${result.summary.suspiciousExternalLinks}`,
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

    if (arg === "--content") {
      args.content = argv[++index];
    } else if (arg === "--routes") {
      args.routes = argv[++index];
    } else if (arg === "--out" || arg === "--output") {
      args.output = argv[++index];
    } else if (arg === "--project-root") {
      args.projectRoot = argv[++index];
    } else if (arg === "--site-url") {
      args.siteUrl = argv[++index];
    } else if (arg === "--media-prefix") {
      args.mediaPrefix = argv[++index];
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
    "Usage: node dist/src/link-cli.js --content formatted-content-output/sanitized-content.json --routes data/route-manifest.json --site-url https://example.com [--out link-output] [--project-root path] [--media-prefix /media/]",
    "",
    "This utility rewrites internal links using the route manifest and reports unresolved internal links.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
