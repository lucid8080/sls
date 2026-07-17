import test from "node:test";
import assert from "node:assert/strict";
import { rewriteInternalLinks } from "../src/link.js";
import { RouteManifestEntry } from "../src/route.js";
import { SanitizedArticle } from "../src/sanitize.js";

test("rewrites old-domain absolute and encoded internal links to canonical paths", () => {
  const result = rewriteInternalLinks(
    [
      article(
        '<p><a href="http://www.example.test/hello-world">A</a><a href="https://example.test/encoded%20path/">B</a></p>',
      ),
    ],
    [route("1", "/hello-world/"), route("2", "/encoded%20path/")],
    { siteUrl: "https://example.test" },
  );

  assert.match(result.content[0].sanitizedContent, /href="\/hello-world\/"/);
  assert.match(result.content[0].sanitizedContent, /href="\/encoded%20path\/"/);
  assert.equal(result.summary.brokenInternalLinks, 0);
});

test("rewrites relative internal links and preserves anchors", () => {
  const result = rewriteInternalLinks(
    [article('<p><a href="../about#team">About</a><a href="#local">Local</a></p>', "/blog/post/")],
    [route("1", "/blog/about/")],
    { siteUrl: "https://example.test" },
  );

  assert.match(result.content[0].sanitizedContent, /href="\/blog\/about\/#team"/);
  assert.match(result.content[0].sanitizedContent, /href="#local"/);
});

test("rewrites old uploads media URLs to the recovered media prefix", () => {
  const result = rewriteInternalLinks(
    [article('<p><img src="https://example.test/wp-content/uploads/2020/01/image.jpg"></p>')],
    [],
    { siteUrl: "https://example.test", mediaPrefix: "/media/" },
  );

  assert.match(result.content[0].sanitizedContent, /src="\/media\/2020\/01\/image.jpg"/);
});

test("rewrites WordPress query-style post links by post ID", () => {
  const result = rewriteInternalLinks(
    [article('<p><a href="https://example.test/?p=123">Legacy</a></p>')],
    [route("123", "/canonical-post/")],
    { siteUrl: "https://example.test" },
  );

  assert.match(result.content[0].sanitizedContent, /href="\/canonical-post\/"/);
  assert.equal(result.summary.brokenInternalLinks, 0);
});

test("preserves homepage links without reporting them as broken", () => {
  const result = rewriteInternalLinks(
    [article('<p><a href="http://www.example.test/">Home</a></p>')],
    [],
    { siteUrl: "https://example.test" },
  );

  assert.match(result.content[0].sanitizedContent, /href="\/"/);
  assert.equal(result.summary.brokenInternalLinks, 0);
});

test("reports old WordPress admin links as high severity", () => {
  const result = rewriteInternalLinks(
    [article('<p><a href="https://example.test/wp-admin/post.php?post=1&amp;action=edit">Edit</a></p>')],
    [],
    { siteUrl: "https://example.test" },
  );

  assert.equal(result.summary.brokenInternalLinks, 1);
  assert.equal(result.reports.brokenInternalLinks[0].severity, "high");
  assert.match(result.content[0].sanitizedContent, /href="#"/);
});

test("neutralizes external WordPress admin links", () => {
  const result = rewriteInternalLinks(
    [article('<p><a href="https://theme.example/wp-admin/post.php?post=1&amp;action=edit">Edit</a></p>')],
    [],
    { siteUrl: "https://example.test" },
  );

  assert.equal(result.summary.suspiciousExternalLinks, 1);
  assert.match(result.content[0].sanitizedContent, /href="#"/);
});

test("preserves external links and flags suspicious external destinations", () => {
  const result = rewriteInternalLinks(
    [article('<p><a href="https://good.example/path">Good</a><a href="https://casino.example/path">Bad</a></p>')],
    [],
    { siteUrl: "https://example.test" },
  );

  assert.match(result.content[0].sanitizedContent, /https:\/\/good.example\/path/);
  assert.equal(result.summary.preservedExternalLinks, 2);
  assert.equal(result.summary.suspiciousExternalLinks, 1);
});

test("reports unresolved internal links without rewriting them", () => {
  const result = rewriteInternalLinks(
    [article('<p><a href="/missing-page/">Missing</a></p>')],
    [route("1", "/known-page/")],
    { siteUrl: "https://example.test" },
  );

  assert.match(result.content[0].sanitizedContent, /href="\/missing-page\/"/);
  assert.equal(result.summary.brokenInternalLinks, 1);
  assert.equal(result.reports.brokenInternalLinks[0].normalizedPath, "/missing-page/");
});

function article(sanitizedContent: string, pathname = "/current/"): SanitizedArticle {
  return {
    id: "99",
    type: "post",
    status: "publish",
    title: "Current",
    slug: "current",
    publishedAt: "2020-01-01 00:00:00",
    modifiedAt: "2020-01-01 00:00:00",
    authorId: "1",
    pathname,
    sanitizedContent,
  };
}

function route(postId: string, pathname: string): RouteManifestEntry {
  return {
    postId,
    originalAbsoluteUrl: `https://example.test${pathname}`,
    originalPathname: pathname,
    newPathname: pathname,
    contentType: "post",
    httpStatusExpectation: "200",
    canonicalPath: pathname,
    redirectRequired: false,
    reviewRequired: false,
    reviewReasons: [],
  };
}
