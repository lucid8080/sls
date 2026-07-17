import { resolve } from "node:path";
import { generateRouteManifest, readSanitizedArticles, writeRouteOutputs, writeRouteOutputsToProject } from "./route.js";

type CliArgs = {
  input?: string;
  output?: string;
  projectRoot?: string;
  siteUrl?: string;
  permalink?: string;
  noTrailingSlash?: boolean;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    printUsageAndExit("Missing required --input path.");
  }

  if (!args.siteUrl) {
    printUsageAndExit("Missing required --site-url value.");
  }

  const articles = readSanitizedArticles(resolve(args.input));
  const result = generateRouteManifest(articles, {
    siteUrl: args.siteUrl,
    permalinkStructure: args.permalink ?? "/%postname%/",
    trailingSlash: !args.noTrailingSlash,
  });

  if (args.output) {
    writeRouteOutputs(resolve(args.output), result);
  }

  if (args.projectRoot) {
    writeRouteOutputsToProject(resolve(args.projectRoot), result);
  }

  process.stdout.write(
    [
      "Route manifest generation complete.",
      `Input: ${resolve(args.input)}`,
      args.output ? `Output: ${resolve(args.output)}` : undefined,
      args.projectRoot ? `Project root: ${resolve(args.projectRoot)}` : undefined,
      `Manifest entries: ${result.manifest.length}`,
      `Redirects: ${result.redirects.length}`,
      `Collisions: ${result.collisions.length}`,
      `Review-required entries: ${result.manifest.filter((entry) => entry.reviewRequired).length}`,
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

    if (arg === "--input") {
      args.input = argv[++index];
    } else if (arg === "--out" || arg === "--output") {
      args.output = argv[++index];
    } else if (arg === "--project-root") {
      args.projectRoot = argv[++index];
    } else if (arg === "--site-url") {
      args.siteUrl = argv[++index];
    } else if (arg === "--permalink") {
      args.permalink = argv[++index];
    } else if (arg === "--no-trailing-slash") {
      args.noTrailingSlash = true;
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
    "Usage: node dist/src/route-cli.js --input formatted-content-output/sanitized-content.json --site-url https://example.com [--permalink '/%postname%/'] [--out route-output] [--project-root path]",
    "",
    "This utility generates a route manifest, redirects list, and route-collision report from",
    "formatted/sanitized content. It does not rewrite article links or create Next.js routes.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
