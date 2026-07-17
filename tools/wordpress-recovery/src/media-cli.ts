import { resolve } from "node:path";
import { scanMedia } from "./media.js";

type CliArgs = {
  input?: string;
  output?: string;
  maxBytes?: number;
  noPdf?: boolean;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    printUsageAndExit("Missing required --input path.");
  }

  const input = resolve(args.input);
  const output = resolve(args.output ?? "wordpress-media-output");
  const report = await scanMedia({
    sourceDir: input,
    outputDir: output,
    maxBytes: args.maxBytes,
    allowPdf: !args.noPdf,
  });

  process.stdout.write(
    [
      "WordPress media recovery scan complete.",
      `Input: ${input}`,
      `Output: ${output}`,
      `Accepted: ${report.accepted.length}`,
      `Rejected: ${report.rejected.length}`,
      `Duplicates: ${report.duplicates.length}`,
      `Missing: ${report.missing.length}`,
      "Accepted raster images were decoded and re-encoded. Source files were not modified.",
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
    } else if (arg === "--max-bytes") {
      args.maxBytes = Number(argv[++index]);
      if (!Number.isFinite(args.maxBytes) || args.maxBytes <= 0) {
        printUsageAndExit("--max-bytes must be a positive number.");
      }
    } else if (arg === "--no-pdf") {
      args.noPdf = true;
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
    "Usage: node dist/src/media-cli.js --input <approved-uploads> [--out <dir>] [--max-bytes <bytes>] [--no-pdf]",
    "",
    "This utility scans an approved uploads directory. It rejects unsafe files, validates signatures,",
    "deduplicates by hash, and re-encodes accepted raster images with Sharp.",
  ]
    .filter(Boolean)
    .join("\n");

  process.stderr.write(`${message}\n`);
  process.exit(error ? 1 : 0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
