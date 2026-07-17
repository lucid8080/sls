import test from "node:test";
import assert from "node:assert/strict";
import { phpUnserialize } from "../src/php-serialize.js";
import {
  expandProductDisplayShortcodes,
  productDisplayMarker,
  reinjectProductDisplayMarkers,
  classifyShortcode,
  parseShortcodeTableId,
} from "../src/product-display.js";

test("phpUnserialize parses AAWP feature lists", () => {
  const raw = 'a:2:{i:0;s:13:"First feature";i:1;s:12:"Second trait";}';
  const parsed = phpUnserialize(raw);
  assert.deepEqual(parsed, ["First feature", "Second trait"]);
});

test("phpUnserialize respects UTF-8 byte lengths for curly quotes", () => {
  const label = "[Editor\u2019s Pick]";
  const byteLength = Buffer.byteLength(label, "utf8");
  const raw = `s:${byteLength}:"${label}";`;
  assert.equal(phpUnserialize(raw), label);
});

test("expandProductDisplayShortcodes emits markers for known ids", () => {
  const reports = { unknownShortcodes: [] as Array<Record<string, unknown>> };
  const html = expandProductDisplayShortcodes(
    '[table id=4 /][amazon table="4232"]',
    { postId: "1", postTitle: "T", originalPath: "/t/" },
    reports as never,
    new Set(["4"]),
    new Set(["4232"]),
  );

  assert.equal(html, `${productDisplayMarker("tablepress", "4")}${productDisplayMarker("aawp", "4232")}`);
  assert.equal(reports.unknownShortcodes.length, 0);
});

test("reinjectProductDisplayMarkers replaces notes in shortcode order", () => {
  const html =
    "<p>A</p><p><em>Migration note: unsupported shortcode removed for manual review.</em></p>" +
    "<p>B</p><p><em>Migration note: unsupported shortcode removed for manual review.</em></p>" +
    "<p>C</p><p><em>Migration note: unsupported shortcode removed for manual review.</em></p>";

  const result = reinjectProductDisplayMarkers(html, [
    { postId: "1", shortcode: '[table id=4 /]', kind: "tablepress", tableId: "4" },
    { postId: "1", shortcode: '[sherpa id="x"]', kind: "other" },
    { postId: "1", shortcode: '[amazon table="4232"]', kind: "aawp", tableId: "4232" },
  ]);

  assert.equal(result.reinjected, 2);
  assert.match(result.html, /data-product-display="tablepress" data-id="4"/);
  assert.match(result.html, /data-product-display="aawp" data-id="4232"/);
  assert.match(result.html, /unsupported shortcode removed/);
});

test("classifyShortcode and parseShortcodeTableId handle table and amazon", () => {
  assert.equal(classifyShortcode('[table id=5 responsive=scroll/]'), "tablepress");
  assert.equal(parseShortcodeTableId('[table id=5 responsive=scroll/]', "tablepress"), "5");
  assert.equal(classifyShortcode('[amazon table="4551"]'), "aawp");
  assert.equal(parseShortcodeTableId('[amazon table="4551"]', "aawp"), "4551");
  assert.equal(classifyShortcode('[sherpa id="x"]'), "other");
});
