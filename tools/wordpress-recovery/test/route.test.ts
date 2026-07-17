import test from "node:test";
import assert from "node:assert/strict";
import { generateRouteManifest } from "../src/route.js";
import { SanitizedArticle } from "../src/sanitize.js";

test("preserves postname permalink paths with trailing slashes", () => {
  const result = generateRouteManifest([article({ id: "1", slug: "hello-world" })], {
    siteUrl: "https://example.test",
    permalinkStructure: "/%postname%/",
  });

  assert.equal(result.manifest[0].originalAbsoluteUrl, "https://example.test/hello-world/");
  assert.equal(result.manifest[0].originalPathname, "/hello-world/");
  assert.equal(result.manifest[0].newPathname, "/hello-world/");
  assert.equal(result.manifest[0].redirectRequired, false);
});

test("supports year and month permalink structures", () => {
  const result = generateRouteManifest(
    [article({ id: "1", slug: "hello-world", publishedAt: "2020-03-04 12:00:00" })],
    {
      siteUrl: "https://example.test",
      permalinkStructure: "/blog/%year%/%monthnum%/%postname%/",
    },
  );

  assert.equal(result.manifest[0].originalPathname, "/blog/2020/03/hello-world/");
});

test("builds nested page paths from parent hierarchy", () => {
  const result = generateRouteManifest(
    [
      article({ id: "10", type: "page", slug: "about" }),
      article({ id: "11", type: "page", slug: "team", parentId: "10" }),
    ],
    {
      siteUrl: "https://example.test",
      permalinkStructure: "/%postname%/",
    },
  );

  assert.equal(result.manifest.find((entry) => entry.postId === "11")?.originalPathname, "/about/team/");
});

test("flags route collisions without generating unsafe redirects", () => {
  const result = generateRouteManifest(
    [
      article({ id: "1", slug: "same" }),
      article({ id: "2", slug: "same" }),
    ],
    {
      siteUrl: "https://example.test",
      permalinkStructure: "/%postname%/",
    },
  );

  assert.equal(result.collisions.length, 1);
  assert.deepEqual(result.collisions[0].postIds, ["1", "2"]);
  assert.equal(result.manifest.every((entry) => entry.httpStatusExpectation === "manual-review"), true);
  assert.equal(result.redirects.length, 0);
});

test("supports no trailing slash mode", () => {
  const result = generateRouteManifest([article({ id: "1", slug: "hello-world" })], {
    siteUrl: "https://example.test",
    permalinkStructure: "/%postname%/",
    trailingSlash: false,
  });

  assert.equal(result.manifest[0].originalPathname, "/hello-world");
});

test("normalizes Windows npm caret-escaped permalink tokens", () => {
  const result = generateRouteManifest([article({ id: "1", slug: "hello-world" })], {
    siteUrl: "https://example.test",
    permalinkStructure: "/^%postname^%/",
  });

  assert.equal(result.manifest[0].originalPathname, "/hello-world/");
  assert.equal(result.collisions.length, 0);
});

test("flags category permalink structures for later taxonomy mapping", () => {
  const result = generateRouteManifest([article({ id: "1", slug: "hello-world" })], {
    siteUrl: "https://example.test",
    permalinkStructure: "/%category%/%postname%/",
  });

  assert.equal(result.manifest[0].originalPathname, "/hello-world/");
  assert.equal(result.manifest[0].reviewRequired, true);
  assert.match(result.manifest[0].reviewReasons.join(" "), /%category%/);
});

function article(overrides: Partial<SanitizedArticle>): SanitizedArticle {
  return {
    id: "1",
    type: "post",
    status: "publish",
    title: "Hello",
    slug: "hello",
    publishedAt: "2020-01-02 03:04:05",
    modifiedAt: "2020-01-03 03:04:05",
    authorId: "1",
    pathname: "/hello/",
    sanitizedContent: "<p>Hello</p>",
    ...overrides,
  };
}
