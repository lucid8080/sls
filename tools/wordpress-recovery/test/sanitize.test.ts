import test from "node:test";
import assert from "node:assert/strict";
import { SanitizedContentResult, sanitizeHtml, sanitizeExtractedContent } from "../src/sanitize.js";
import { ExtractedContent } from "../src/types.js";

function makeReports(): SanitizedContentResult["reports"] {
  return {
    removedContent: [],
    suspiciousLinks: [],
    suspiciousHtml: [],
  };
}

const context = {
  postId: "42",
  postTitle: "Unsafe Test",
  originalPath: "/unsafe-test/",
  siteHost: "simplelifesaver.com",
};

test("preserves allowed editorial HTML and safe attributes", () => {
  const reports = makeReports();
  const html = sanitizeHtml(
    '<h2>Title</h2><p>Hello <strong>safe</strong> <a href="https://simplelifesaver.com/path/" title="Go">link</a></p><table><tr><td colspan="2">Cell</td></tr></table>',
    context,
    reports,
  );

  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>safe<\/strong>/);
  assert.match(html, /href="https:\/\/simplelifesaver.com\/path\/"/);
  assert.match(html, /colspan="2"/);
  assert.equal(reports.removedContent.length, 0);
});

test("removes scripts, iframes, event handlers, and unsafe protocols", () => {
  const reports = makeReports();
  const html = sanitizeHtml(
    '<p onclick="evil()">Hi</p><script>alert(1)</script><iframe src="https://www.youtube.com/embed/id"></iframe><a href="javascript:alert(1)">bad</a><img src="data:text/html;base64,PGgxPg==" onerror="x">',
    context,
    reports,
  );

  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("<iframe"), false);
  assert.equal(html.includes("onclick"), false);
  assert.equal(html.includes("javascript:"), false);
  assert.equal(html.includes("data:text/html"), false);
  assert.equal(reports.removedContent.some((entry) => entry.reason.includes("<script>")), true);
  assert.equal(reports.removedContent.some((entry) => entry.reason.includes("<iframe>")), true);
  assert.equal(reports.suspiciousLinks.some((entry) => entry.reason.includes("disallowed protocol")), true);
});

test("removes tracking pixels and suspicious comments without live payload previews", () => {
  const reports = makeReports();
  const html = sanitizeHtml(
    '<!-- <script>alert(1)</script> --><p>Text</p><img src="/pixel.gif" width="1" height="1" alt="">',
    context,
    reports,
  );

  assert.equal(html, "<p>Text</p>");
  assert.equal(reports.suspiciousHtml.length, 1);
  assert.equal(reports.removedContent.some((entry) => entry.reason.includes("tracking pixel")), true);
  assert.equal(reports.suspiciousHtml[0].preview.includes("<script>"), false);
  assert.equal(reports.suspiciousHtml[0].preview.includes("&lt;script&gt;"), true);
});

test("normalizes nbsp entities to regular spaces instead of double-escaping them", () => {
  const reports = makeReports();
  const html = sanitizeHtml(
    "<p>The&nbsp;Whirlpool&amp;nbsp;model costs $&nbsp;549.</p>",
    context,
    reports,
  );

  assert.equal(html.includes("&nbsp;"), false);
  assert.equal(html.includes("&amp;nbsp;"), false);
  assert.match(html, /The Whirlpool model costs \$ 549\./);
});

test("collapses double-encoded ampersands so they do not render as visible &amp;", () => {
  const reports = makeReports();
  const html = sanitizeHtml(
    "<p>Wash &amp;amp; Inspect — Tom &amp; Jerry</p>",
    context,
    reports,
  );

  assert.equal(html.includes("&amp;amp;"), false);
  assert.match(html, /Wash &amp; Inspect/);
  assert.match(html, /Tom &amp; Jerry/);
});

test("removes unknown shortcodes and reports external links for review", () => {
  const reports = makeReports();
  const html = sanitizeHtml(
    '<p>[wpcode id="123"] Visit <a href="http://hitclub.example/path">spam</a> and <a href="https://www.amazon.com/item">store</a>.</p>',
    context,
    reports,
  );

  assert.equal(html.includes("[wpcode"), false);
  assert.equal(reports.removedContent.some((entry) => entry.reason.includes("Unknown shortcode")), true);
  assert.equal(reports.suspiciousLinks.some((entry) => entry.severity === "high"), true);
  assert.equal(reports.suspiciousLinks.some((entry) => entry.reason.includes("External link preserved")), true);
});

test("sanitizes extracted content into non-executable JSON artifacts", () => {
  const extraction: ExtractedContent = {
    source: {
      path: "sample.sql",
      format: "sql",
      tablePrefix: "wp_",
    },
    summary: {
      publishedPosts: 1,
      publishedPages: 0,
      attachments: 0,
      nonPublicContent: 0,
      customPostTypes: 0,
      orphanedAttachments: 0,
    },
    content: [
      {
        id: "1",
        type: "post",
        status: "publish",
        title: "Hello",
        slug: "hello",
        rawContent: '<p>Safe</p><script>alert(1)</script>',
        requiresSanitization: true,
      },
    ],
    attachments: [],
    reports: {
      nonPublicContent: [],
      customPostTypes: [],
      orphanedAttachments: [],
    },
  };

  const result = sanitizeExtractedContent(extraction, "https://simplelifesaver.com");

  assert.equal(result.sanitizedContent.length, 1);
  assert.equal(result.sanitizedContent[0].pathname, "/hello/");
  assert.equal(result.sanitizedContent[0].sanitizedContent, "<p>Safe</p>");
  assert.equal("rawContent" in result.sanitizedContent[0], false);
  assert.equal("requiresSanitization" in result.sanitizedContent[0], false);
  assert.equal(result.reports.removedContent.length, 1);
});
