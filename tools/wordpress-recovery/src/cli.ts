import { resolve } from "node:path";
import { extractContent, writeExtraction } from "./extract.js";
import { parseWordPressDump } from "./sql.js";

type CliArgs = {
  input?: string;
  output?: string;
  prefix?: string;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    printUsageAndExit("Missing required --input path.");
  }

  const input = resolve(args.input);
  const output = resolve(args.output ?? "wordpress-recovery-output");
  const dump = parseWordPressDump(input, { prefix: args.prefix });
  const extraction = extractContent(dump);

  writeExtraction(output, extraction);

  process.stdout.write(
    [
      "WordPress recovery extraction complete.",
      `Input: ${input}`,
      `Output: ${output}`,
      `Format: ${dump.inputFormat}`,
      `Database: ${dump.databaseName ?? "(unknown)"}`,
      `Table prefix: ${dump.tablePrefix}`,
      `Published posts: ${extraction.summary.publishedPosts}`,
      `Published pages: ${extraction.summary.publishedPages}`,
      `Attachments: ${extraction.summary.attachments}`,
      `Non-public report entries: ${extraction.summary.nonPublicContent}`,
      `Custom post type report entries: ${extraction.summary.customPostTypes}`,
      `Orphaned attachment report entries: ${extraction.summary.orphanedAttachments}`,
      "Raw content requires sanitizer/conversion before use in React.",
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
    "Usage: node dist/src/cli.js --input <dump.sql|dump.sql.gz|dump.zip> [--out <dir>] [--prefix r14_]",
    "",
    "This utility parses a WordPress SQL dump read-only. It does not start WordPress, execute PHP,",
    "start MySQL, copy media files, or sanitize article HTML.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main();
