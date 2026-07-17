import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync, gzipSync } from "node:zlib";
import { extractContent } from "../src/extract.js";
import { readSqlInput } from "../src/input.js";
import { parseInsertStatement, parseValues, parseWordPressDump } from "../src/sql.js";

const fixturePath = join(process.cwd(), "test", "fixtures", "sample.sql");

test("parses MySQL values with quoted commas and escaped characters", () => {
  const rows = parseValues("('hello, world', 'Bob\\'s value', NULL, 42)");

  assert.deepEqual(rows, [["hello, world", "Bob's value", null, "42"]]);
});

test("parses INSERT statements into table, columns, and rows", () => {
  const statement = "INSERT INTO `wp_posts` (`ID`, `post_title`) VALUES\n(1, 'Hello');";
  const parsed = parseInsertStatement(statement);

  assert.equal(parsed?.table, "wp_posts");
  assert.deepEqual(parsed?.columns, ["ID", "post_title"]);
  assert.deepEqual(parsed?.rows, [["1", "Hello"]]);
});

test("detects prefix and parses only allowed WordPress tables", () => {
  const dump = parseWordPressDump(fixturePath);

  assert.equal(dump.databaseName, "sample_wp");
  assert.equal(dump.tablePrefix, "wp_");
  assert.equal(dump.records.posts.length, 8);
  assert.equal(dump.records.postmeta.length, 5);
  assert.equal(dump.records.options.length, 2);
  assert.equal(Object.keys(dump.records).includes("plugin_noise"), false);
});

test("extracts published posts and pages while reporting unsafe publishing candidates", () => {
  const extraction = extractContent(parseWordPressDump(fixturePath));

  assert.equal(extraction.summary.publishedPosts, 1);
  assert.equal(extraction.summary.publishedPages, 1);
  assert.equal(extraction.summary.attachments, 2);
  assert.equal(extraction.content.length, 2);
  assert.equal(extraction.content[0].requiresSanitization, true);
  assert.equal(extraction.content[0].featuredMedia?.attachmentId, "4");
  assert.equal(extraction.content[0].featuredMedia?.sourcePath, "2020/01/hero.jpg");
  assert.equal(extraction.content[0].featuredMedia?.alt, "Hero alt text");
  assert.equal(extraction.content[0].featuredMedia?.sizes[0].sourcePath, "2020/01/hero-150x150.jpg");
  assert.equal(extraction.attachments[0].attachedFile, "2020/01/hero.jpg");
  assert.equal(extraction.attachments[0].width, 1200);
  assert.equal(extraction.attachments[0].sizes.length, 2);
  assert.equal(extraction.reports.nonPublicContent.some((entry) => entry.status === "draft"), true);
  assert.equal(extraction.reports.nonPublicContent.some((entry) => entry.type === "revision"), true);
  assert.equal(extraction.reports.customPostTypes.some((entry) => entry.type === "product"), true);
  assert.equal(extraction.reports.orphanedAttachments.some((entry) => entry.id === "5"), true);
});

test("reads .sql.gz input", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "wp-recovery-"));
  const gzPath = join(tempDir, "sample.sql.gz");
  writeFileSync(gzPath, gzipSync(readFileSync(fixturePath)));

  const input = readSqlInput(gzPath);

  assert.equal(input.format, "sql.gz");
  assert.match(input.sql, /CREATE TABLE `wp_posts`/);
});

test("reads .zip input containing SQL", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "wp-recovery-"));
  const zipPath = join(tempDir, "sample.zip");
  writeFileSync(zipPath, createZip("nested/sample.sql", readFileSync(fixturePath)));

  const input = readSqlInput(zipPath);

  assert.equal(input.format, "zip");
  assert.equal(input.memberName, "nested/sample.sql");
  assert.match(input.sql, /CREATE TABLE `wp_posts`/);
});

function createZip(name: string, content: Buffer): Buffer {
  const nameBuffer = Buffer.from(name, "utf8");
  const compressed = deflateRawSync(content);
  const localHeaderOffset = 0;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(0, 10);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralDirectoryOffset = localHeader.length + nameBuffer.length + compressed.length;
  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(8, 10);
  centralDirectory.writeUInt32LE(0, 12);
  centralDirectory.writeUInt32LE(0, 16);
  centralDirectory.writeUInt32LE(compressed.length, 20);
  centralDirectory.writeUInt32LE(content.length, 24);
  centralDirectory.writeUInt16LE(nameBuffer.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt16LE(0, 34);
  centralDirectory.writeUInt16LE(0, 36);
  centralDirectory.writeUInt32LE(0, 38);
  centralDirectory.writeUInt32LE(localHeaderOffset, 42);

  const centralDirectorySize = centralDirectory.length + nameBuffer.length;
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(1, 8);
  endOfCentralDirectory.writeUInt16LE(1, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    nameBuffer,
    compressed,
    centralDirectory,
    nameBuffer,
    endOfCentralDirectory,
  ]);
}
