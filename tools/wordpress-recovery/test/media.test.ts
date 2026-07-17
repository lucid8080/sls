import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { scanMedia } from "../src/media.js";

test("re-encodes accepted raster images and writes media reports", async () => {
  const { input, output } = makeDirs();
  const imagePath = join(input, "2020", "01", "hero.png");
  await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: "#336699",
    },
  })
    .png()
    .toFile(imagePath);

  const report = await scanMedia({ sourceDir: input, outputDir: output });

  assert.equal(report.accepted.length, 1);
  assert.equal(report.accepted[0].mediaType, "png");
  assert.equal(report.accepted[0].width, 2);
  assert.equal(report.accepted[0].height, 2);
  assert.match(report.accepted[0].outputPath ?? "", /^media\/2020\/01\/hero\.webp$/);
  assert.equal(existsSync(join(output, report.accepted[0].outputPath ?? "")), true);
  assert.equal(existsSync(join(output, "reports", "media-accepted.json")), true);
  assert.equal(existsSync(join(output, "reports", "media-rejected.json")), true);
});

test("rejects unsafe executable and unsupported non-media extensions", async () => {
  const { input, output } = makeDirs();
  writeFileSync(join(input, "shell.php"), "<?php echo 'bad';");
  writeFileSync(join(input, ".htaccess"), "AddHandler application/x-httpd-php .jpg");
  writeFileSync(join(input, "export.CSV"), "url\nhttps://example.test");

  const report = await scanMedia({ sourceDir: input, outputDir: output });

  assert.equal(report.accepted.length, 0);
  assert.equal(report.rejected.length, 3);
  assert.equal(report.rejected.some((entry) => entry.originalPath === "shell.php" && entry.severity === "high"), true);
  assert.equal(report.rejected.some((entry) => entry.originalPath === ".htaccess" && entry.severity === "high"), true);
  assert.equal(report.rejected.some((entry) => entry.originalPath === "export.CSV"), true);
});

test("rejects signature and extension mismatches", async () => {
  const { input, output } = makeDirs();
  const imageBuffer = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: "#000000",
    },
  })
    .png()
    .toBuffer();
  writeFileSync(join(input, "wrong.jpg"), imageBuffer);

  const report = await scanMedia({ sourceDir: input, outputDir: output });

  assert.equal(report.accepted.length, 0);
  assert.equal(report.rejected.length, 1);
  assert.match(report.rejected[0].reason, /does not match detected PNG signature/);
});

test("deduplicates files by content hash", async () => {
  const { input, output } = makeDirs();
  const imageBuffer = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: "#ffffff",
    },
  })
    .jpeg()
    .toBuffer();
  writeFileSync(join(input, "first.jpg"), imageBuffer);
  writeFileSync(join(input, "second.jpg"), imageBuffer);

  const report = await scanMedia({ sourceDir: input, outputDir: output });

  assert.equal(report.accepted.length, 1);
  assert.equal(report.duplicates.length, 1);
  assert.equal(report.duplicates[0].originalPath, "second.jpg");
  assert.equal(report.duplicates[0].duplicateOf, "first.jpg");
});

test("can reject PDFs when disabled", async () => {
  const { input, output } = makeDirs();
  writeFileSync(join(input, "file.pdf"), "%PDF-1.4\n%");

  const report = await scanMedia({ sourceDir: input, outputDir: output, allowPdf: false });

  assert.equal(report.accepted.length, 0);
  assert.equal(report.rejected.length, 1);
  assert.match(report.rejected[0].reason, /PDF files are disabled/);
});

function makeDirs(): { input: string; output: string } {
  const root = mkdtempSync(join(tmpdir(), "wp-media-"));
  const input = join(root, "input");
  const output = join(root, "output");
  mkdirSync(join(input, "2020", "01"), { recursive: true });
  mkdirSync(output, { recursive: true });
  sharp.cache(false);
  writeFileSync(join(root, ".keep"), "");
  return { input, output };
}
