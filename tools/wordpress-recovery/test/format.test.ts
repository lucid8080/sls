import test from "node:test";
import assert from "node:assert/strict";
import { convertWordPressFormatting, formatAndSanitizeDump } from "../src/format.js";
import { parseWordPressDump } from "../src/sql.js";
import { ExtractedContent } from "../src/types.js";

test("removes Gutenberg comment wrappers while preserving visible HTML", () => {
  const result = convertWordPressFormatting(makeExtraction("<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->"));

  assert.equal(result.extraction.content[0].rawContent, "<p>Hello</p>");
});

test("converts caption shortcodes to figure and figcaption", () => {
  const result = convertWordPressFormatting(
    makeExtraction('[caption id="attachment_1" width="300"]<img src="/media/a.jpg" alt="A"> A caption[/caption]'),
  );

  assert.match(result.extraction.content[0].rawContent, /^<figure><img src="\/media\/a.jpg" alt="A"><figcaption>A caption<\/figcaption><\/figure>$/);
  assert.equal(result.reports.formattingWarnings.length, 0);
});

test("converts galleries to manual-review placeholders", () => {
  const result = convertWordPressFormatting(makeExtraction('<p>Before</p>[gallery ids="1,2,3"]<p>After</p>'));

  assert.match(result.extraction.content[0].rawContent, /Gallery requires manual review/);
  assert.equal(result.reports.formattingWarnings.length, 1);
});

test("converts embeds and iframes to safe canonical links", () => {
  const result = convertWordPressFormatting(
    makeExtraction('[embed]https://youtu.be/abc123[/embed]<iframe src="https://www.youtube.com/embed/xyz789"></iframe>'),
  );

  assert.match(result.extraction.content[0].rawContent, /https:\/\/www.youtube.com\/watch\?v=abc123/);
  assert.match(result.extraction.content[0].rawContent, /https:\/\/www.youtube.com\/watch\?v=xyz789/);
  assert.equal(result.extraction.content[0].rawContent.includes("<iframe"), false);
});

test("reports unknown shortcodes without executing them", () => {
  const result = convertWordPressFormatting(makeExtraction('<p>Text</p>[wpcode id="123"][/wpcode]'));

  assert.equal(result.reports.unknownShortcodes.length, 2);
  assert.equal(result.reports.unknownShortcodes[0].shortcode, '[wpcode id="123"]');
  assert.match(result.extraction.content[0].rawContent, /unsupported shortcode removed/);
});

test("expands TablePress and AAWP table shortcodes into product display markers", () => {
  const result = convertWordPressFormatting(
    makeExtraction('<p>Before</p>[table id=4 responsive=scroll/]<p>Mid</p>[amazon table="4232"]<p>After</p>'),
    {
      tablepressIds: new Set(["4"]),
      aawpIds: new Set(["4232"]),
    },
  );

  assert.match(
    result.extraction.content[0].rawContent,
    /data-product-display="tablepress" data-id="4"/,
  );
  assert.match(
    result.extraction.content[0].rawContent,
    /data-product-display="aawp" data-id="4232"/,
  );
  assert.equal(result.extraction.content[0].rawContent.includes("unsupported shortcode"), false);
  assert.equal(result.reports.unknownShortcodes.length, 0);
});

test("format and sanitize pipeline produces safe content and unknown shortcode report", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  dump.records.posts[0].post_content =
    '<!-- wp:paragraph --><p>Safe</p><!-- /wp:paragraph -->[custom_bad]<iframe src="https://www.youtube.com/embed/video-id"></iframe>';

  const result = formatAndSanitizeDump(dump, "https://example.test");

  assert.equal(result.sanitized.sanitizedContent.length, 2);
  assert.equal(result.sanitized.sanitizedContent[0].sanitizedContent.includes("<iframe"), false);
  assert.match(result.sanitized.sanitizedContent[0].sanitizedContent, /https:\/\/www.youtube.com\/watch\?v=video-id/);
  assert.equal(result.formatting.reports.unknownShortcodes.length, 1);
});

function makeExtraction(rawContent: string): ExtractedContent {
  return {
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
        rawContent,
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
}
