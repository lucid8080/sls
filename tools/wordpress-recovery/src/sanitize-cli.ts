import { resolve } from "node:path";
import { extractContent } from "./extract.js";
import { sanitizeExtractedContent, writeSanitizedOutput } from "./sanitize.js";
import { parseWordPressDump } from "./sql.js";

type CliArgs = {
  input?: string;
  output?: string;
  prefix?: string;
  siteUrl?: string;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    printUsageAndExit("Missing required --input path.");
  }

  const input = resolve(args.input);
  const output = resolve(args.output ?? "sanitized-content-output");
  const dump = parseWordPressDump(input, { prefix: args.prefix });
  const extraction = extractContent(dump);
  const sanitized = sanitizeExtractedContent(extraction, args.siteUrl);

  writeSanitizedOutput(output, sanitized);

  process.stdout.write(
    [
      "WordPress content sanitizer complete.",
      `Input: ${input}`,
      `Output: ${output}`,
      `Sanitized articles: ${sanitized.sanitizedContent.length}`,
      `Removed content entries: ${sanitized.reports.removedContent.length}`,
      `Suspicious link entries: ${sanitized.reports.suspiciousLinks.length}`,
      `Suspicious HTML entries: ${sanitized.reports.suspiciousHtml.length}`,
      "Sanitized content is still a migration artifact and should be route-mapped before publishing.",
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
    "Usage: node dist/src/sanitize-cli.js --input <dump.sql|dump.sql.gz|dump.zip> [--out <dir>] [--prefix r14_] [--site-url https://example.com]",
    "",
    "This utility parses the approved SQL dump, extracts published posts/pages, sanitizes raw article",
    "HTML with an allowlist, and writes malware-aware reports. It does not produce executable MDX.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
