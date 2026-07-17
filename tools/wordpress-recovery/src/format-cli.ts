import { resolve } from "node:path";
import { formatAndSanitizeDump, writeFormattedOutput } from "./format.js";
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
  const output = resolve(args.output ?? "formatted-content-output");
  const dump = parseWordPressDump(input, { prefix: args.prefix });
  const result = formatAndSanitizeDump(dump, args.siteUrl);

  writeFormattedOutput(output, result);

  process.stdout.write(
    [
      "WordPress formatting conversion complete.",
      `Input: ${input}`,
      `Output: ${output}`,
      `Formatted and sanitized articles: ${result.sanitized.sanitizedContent.length}`,
      `Removed content entries: ${result.sanitized.reports.removedContent.length}`,
      `Suspicious link entries: ${result.sanitized.reports.suspiciousLinks.length}`,
      `Suspicious HTML entries: ${result.sanitized.reports.suspiciousHtml.length}`,
      `Unknown shortcode entries: ${result.formatting.reports.unknownShortcodes.length}`,
      `Formatting warning entries: ${result.formatting.reports.formattingWarnings.length}`,
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
    "Usage: node dist/src/format-cli.js --input <dump.sql|dump.sql.gz|dump.zip> [--out <dir>] [--prefix r14_] [--site-url https://example.com]",
    "",
    "This utility converts WordPress formatting before sanitization. It handles Gutenberg wrappers,",
    "captions, galleries, embeds, iframes, buttons/links, and unknown shortcode reporting.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
