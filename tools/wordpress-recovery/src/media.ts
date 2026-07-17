import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative, sep } from "node:path";
import sharp from "sharp";

export type MediaScanOptions = {
  sourceDir: string;
  outputDir: string;
  maxBytes?: number;
  allowPdf?: boolean;
};

export type MediaAccepted = {
  originalPath: string;
  outputPath?: string;
  mediaType: MediaKind;
  originalBytes: number;
  hash: string;
  width?: number;
  height?: number;
};

export type MediaRejected = {
  originalPath: string;
  reason: string;
  severity: "low" | "medium" | "high";
  preview: string;
  manualReview: boolean;
};

export type MediaDuplicate = {
  originalPath: string;
  duplicateOf: string;
  hash: string;
};

export type MediaReport = {
  sourceDir: string;
  outputDir: string;
  accepted: MediaAccepted[];
  rejected: MediaRejected[];
  duplicates: MediaDuplicate[];
  missing: Array<{ originalPath: string; reason: string }>;
};

type MediaKind = "jpeg" | "png" | "webp" | "gif" | "avif" | "pdf";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const RASTER_KINDS = new Set<MediaKind>(["jpeg", "png", "webp", "gif", "avif"]);
const EXECUTABLE_EXTENSIONS = new Set([
  ".php",
  ".phtml",
  ".phar",
  ".js",
  ".mjs",
  ".cjs",
  ".html",
  ".htm",
  ".svg",
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".cgi",
  ".pl",
]);
const UNSUPPORTED_EXTENSIONS = new Set([".css", ".json", ".xml", ".csv", ".log", ".txt", ".xlsx", ".mp4"]);

export async function scanMedia(options: MediaScanOptions): Promise<MediaReport> {
  const sourceDir = normalize(options.sourceDir);
  const outputDir = normalize(options.outputDir);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const report: MediaReport = {
    sourceDir,
    outputDir,
    accepted: [],
    rejected: [],
    duplicates: [],
    missing: [],
  };
  const seenHashes = new Map<string, string>();

  for (const path of listFiles(sourceDir)) {
    const relativePath = normalizeRelativePath(relative(sourceDir, path));
    const rejection = preflightReject(path, relativePath, sourceDir, maxBytes, options.allowPdf ?? true);

    if (rejection) {
      report.rejected.push(rejection);
      continue;
    }

    const buffer = readFileSync(path);
    const detected = detectMediaKind(buffer);

    if (!detected) {
      report.rejected.push(reject(relativePath, "File signature is not an allowed media type.", "high"));
      continue;
    }

    const extensionValidation = validateExtension(relativePath, detected, options.allowPdf ?? true);
    if (extensionValidation) {
      report.rejected.push(extensionValidation);
      continue;
    }

    const hash = createHash("sha256").update(buffer).digest("hex");
    const duplicateOf = seenHashes.get(hash);
    if (duplicateOf) {
      report.duplicates.push({ originalPath: relativePath, duplicateOf, hash });
      continue;
    }
    seenHashes.set(hash, relativePath);

    if (detected === "pdf") {
      report.accepted.push({
        originalPath: relativePath,
        mediaType: "pdf",
        originalBytes: buffer.length,
        hash,
      });
      continue;
    }

    try {
      const processed = await reencodeRaster(buffer, detected);
      const outputPath = outputPathFor(outputDir, relativePath, processed.extension);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, processed.buffer);
      report.accepted.push({
        originalPath: relativePath,
        outputPath: normalizeRelativePath(relative(outputDir, outputPath)),
        mediaType: detected,
        originalBytes: buffer.length,
        hash,
        width: processed.width,
        height: processed.height,
      });
    } catch (error) {
      report.rejected.push(
        reject(
          relativePath,
          `Sharp could not safely decode and re-encode this image: ${error instanceof Error ? error.message : "unknown error"}`,
          "high",
        ),
      );
    }
  }

  writeReports(outputDir, report);
  return report;
}

function listFiles(sourceDir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(sourceDir, entry.name);

    if (entry.isSymbolicLink()) {
      files.push(path);
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...listFiles(path));
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function preflightReject(
  path: string,
  relativePath: string,
  sourceDir: string,
  maxBytes: number,
  allowPdf: boolean,
): MediaRejected | undefined {
  const normalizedAbsolute = normalize(path);
  if (!normalizedAbsolute.startsWith(sourceDir + sep) && normalizedAbsolute !== sourceDir) {
    return reject(relativePath, "Path escapes the approved source directory.", "high");
  }

  const lstat = lstatSync(path);
  if (lstat.isSymbolicLink()) {
    return reject(relativePath, "Symlinks are not allowed in approved media input.", "high");
  }

  const stat = statSync(path);
  if (!stat.isFile()) {
    return reject(relativePath, "Entry is not a regular file.", "high");
  }

  if (stat.size > maxBytes) {
    return reject(relativePath, `File exceeds max size of ${maxBytes} bytes.`, "medium");
  }

  if (relativePath.split(/[\\/]/).some((part) => part === ".." || part === "")) {
    return reject(relativePath, "Path contains traversal or empty path segments.", "high");
  }

  const lowerName = basename(relativePath).toLowerCase();
  const extensions = lowerName.match(/\.[a-z0-9]+/g) ?? [];
  const finalExtension = extname(lowerName);

  if (extensions.length > 1 && extensions.some((extension) => EXECUTABLE_EXTENSIONS.has(extension))) {
    return reject(relativePath, "Filename contains an executable double extension.", "high");
  }

  if (EXECUTABLE_EXTENSIONS.has(finalExtension)) {
    return reject(relativePath, `Executable or unsafe extension '${finalExtension}' is not allowed.`, "high");
  }

  if (!allowPdf && finalExtension === ".pdf") {
    return reject(relativePath, "PDF files are disabled by configuration.", "medium");
  }

  if (UNSUPPORTED_EXTENSIONS.has(finalExtension)) {
    return reject(relativePath, `Unsupported non-media extension '${finalExtension}' is not allowed.`, "medium");
  }

  return undefined;
}

function validateExtension(relativePath: string, kind: MediaKind, allowPdf: boolean): MediaRejected | undefined {
  const extension = extname(relativePath).toLowerCase();
  const allowedExtensions: Record<MediaKind, string[]> = {
    jpeg: [".jpg", ".jpeg"],
    png: [".png"],
    webp: [".webp"],
    gif: [".gif"],
    avif: [".avif"],
    pdf: [".pdf"],
  };

  if (kind === "pdf" && !allowPdf) {
    return reject(relativePath, "PDF files are disabled by configuration.", "medium");
  }

  if (!allowedExtensions[kind].includes(extension)) {
    return reject(
      relativePath,
      `File extension '${extension}' does not match detected ${kind.toUpperCase()} signature.`,
      "high",
    );
  }

  return undefined;
}

function detectMediaKind(buffer: Buffer): MediaKind | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") {
    return "gif";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") {
      return "avif";
    }
  }
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "pdf";
  }
  return undefined;
}

async function reencodeRaster(
  buffer: Buffer,
  kind: Exclude<MediaKind, "pdf">,
): Promise<{ buffer: Buffer; extension: string; width?: number; height?: number }> {
  const image = sharp(buffer, { failOn: "warning" }).rotate();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Missing image dimensions.");
  }

  if (kind === "gif") {
    const output = await image.gif().toBuffer();
    return { buffer: output, extension: ".gif", width: metadata.width, height: metadata.height };
  }

  const output = await image.webp({ quality: 82 }).toBuffer();
  return { buffer: output, extension: ".webp", width: metadata.width, height: metadata.height };
}

function outputPathFor(outputDir: string, relativePath: string, extension: string): string {
  const parsedExtension = extname(relativePath);
  const safeRelative = relativePath
    .slice(0, parsedExtension ? -parsedExtension.length : undefined)
    .replace(/[^a-zA-Z0-9/._-]+/g, "-");
  return join(outputDir, "media", `${safeRelative}${extension}`);
}

function writeReports(outputDir: string, report: MediaReport): void {
  const reportsDir = join(outputDir, "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeJson(join(reportsDir, "media-accepted.json"), report.accepted);
  writeJson(join(reportsDir, "media-rejected.json"), report.rejected);
  writeJson(join(reportsDir, "media-missing.json"), report.missing);
  writeJson(join(reportsDir, "media-duplicates.json"), report.duplicates);
}

function reject(
  originalPath: string,
  reason: string,
  severity: MediaRejected["severity"],
): MediaRejected {
  return {
    originalPath,
    reason,
    severity,
    preview: originalPath.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 160),
    manualReview: true,
  };
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join("/");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
