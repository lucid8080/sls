import test from "node:test";
import assert from "node:assert/strict";
import { generateRouteManifest } from "../src/route.js";
import { SanitizedArticle } from "../src/sanitize.js";
import { buildSeoOutput } from "../src/seo.js";
import { parseWordPressDump } from "../src/sql.js";

test("resolves Yoast %%title%% %%page%% templates to the WordPress title", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  dump.records.postmeta.push({
    meta_id: "10",
    post_id: "1",
    meta_key: "_yoast_wpseo_title",
    meta_value: "%%title%% %%page%%",
  });
  const articles = [article({ id: "1", slug: "published-post", title: "Instant Pot Sputtering Solved" })];
  const routes = generateRouteManifest(articles, { siteUrl: "https://example.test", permalinkStructure: "/%postname%/" }).manifest;

  const output = buildSeoOutput(dump, articles, routes, { siteUrl: "https://example.test" });

  assert.equal(output.metadata[0].title, "Instant Pot Sputtering Solved");
  assert.equal(output.metadata[0].source.title, "yoast");
  assert.equal(/%%\w+%%/.test(output.metadata[0].title), false);
});

test("recovers Yoast metadata before generated fallbacks", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  dump.records.postmeta.push(
    { meta_id: "10", post_id: "1", meta_key: "_yoast_wpseo_title", meta_value: "Yoast Title" },
    { meta_id: "11", post_id: "1", meta_key: "_yoast_wpseo_metadesc", meta_value: "Yoast Description" },
  );
  const articles = [article({ id: "1", slug: "published-post", title: "WP Title" })];
  const routes = generateRouteManifest(articles, { siteUrl: "https://example.test", permalinkStructure: "/%postname%/" }).manifest;

  const output = buildSeoOutput(dump, articles, routes, { siteUrl: "https://example.test" });

  assert.equal(output.metadata[0].title, "Yoast Title");
  assert.equal(output.metadata[0].description, "Yoast Description");
  assert.equal(output.metadata[0].source.title, "yoast");
  assert.equal(output.metadata[0].source.description, "yoast");
});

test("falls back to Rank Math metadata and rejects spammy values", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  dump.records.postmeta.push(
    { meta_id: "10", post_id: "1", meta_key: "_yoast_wpseo_title", meta_value: "Casino <script>bad</script>" },
    { meta_id: "11", post_id: "1", meta_key: "rank_math_title", meta_value: "Rank Title" },
    { meta_id: "12", post_id: "1", meta_key: "rank_math_description", meta_value: "Rank Description" },
  );
  const articles = [article({ id: "1", slug: "published-post", title: "WP Title" })];
  const routes = generateRouteManifest(articles, { siteUrl: "https://example.test", permalinkStructure: "/%postname%/" }).manifest;

  const output = buildSeoOutput(dump, articles, routes, { siteUrl: "https://example.test" });

  assert.equal(output.metadata[0].title, "Rank Title");
  assert.equal(output.metadata[0].description, "Rank Description");
  assert.equal(output.review.some((entry) => entry.reason.includes("Rejected suspicious SEO title")), true);
});

test("rejects canonical URLs on unapproved domains", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  dump.records.postmeta.push({
    meta_id: "10",
    post_id: "1",
    meta_key: "_yoast_wpseo_canonical",
    meta_value: "https://evil.example/spam/",
  });
  const articles = [article({ id: "1", slug: "published-post" })];
  const routes = generateRouteManifest(articles, { siteUrl: "https://example.test", permalinkStructure: "/%postname%/" }).manifest;

  const output = buildSeoOutput(dump, articles, routes, { siteUrl: "https://example.test" });

  assert.equal(output.metadata[0].canonicalUrl, "https://example.test/published-post/");
  assert.equal(output.review.some((entry) => entry.reason.includes("Rejected canonical URL")), true);
});

test("recovers categories, tags, authors, structured data, and XML outputs", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  dump.records.terms.push({ term_id: "2", name: "Robots", slug: "robots" });
  dump.records.term_taxonomy.push({ term_taxonomy_id: "20", term_id: "2", taxonomy: "post_tag", description: "", parent: "0", count: "1" });
  dump.records.term_relationships.push({ object_id: "1", term_taxonomy_id: "20", term_order: "0" });
  const articles = [article({ id: "1", slug: "published-post", authorId: "1" })];
  const routes = generateRouteManifest(articles, { siteUrl: "https://example.test", permalinkStructure: "/%postname%/" }).manifest;

  const output = buildSeoOutput(dump, articles, routes, { siteUrl: "https://example.test" });

  assert.equal(output.metadata[0].categories[0].name, "Guides");
  assert.equal(output.metadata[0].tags[0].name, "Robots");
  assert.equal(output.metadata[0].article?.author, "Admin");
  assert.match(output.sitemapXml, /<loc>https:\/\/example.test\/published-post\/<\/loc>/);
  assert.match(output.robotsTxt, /Sitemap: https:\/\/example.test\/sitemap.xml/);
  assert.match(output.rssXml, /<rss version="2.0">/);
});

test("excludes noindex content from sitemap", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  dump.records.postmeta.push({
    meta_id: "10",
    post_id: "1",
    meta_key: "_yoast_wpseo_meta-robots-noindex",
    meta_value: "1",
  });
  const articles = [article({ id: "1", slug: "published-post" })];
  const routes = generateRouteManifest(articles, { siteUrl: "https://example.test", permalinkStructure: "/%postname%/" }).manifest;

  const output = buildSeoOutput(dump, articles, routes, { siteUrl: "https://example.test" });

  assert.equal(output.metadata[0].noindex, true);
  assert.equal(output.sitemapXml.includes("published-post"), false);
  assert.equal(output.review.some((entry) => entry.reason.includes("noindex")), true);
});

test("rejects spammy WordPress fallback titles and excludes them from sitemap and RSS", () => {
  const dump = parseWordPressDump("test/fixtures/sample.sql");
  const articles = [article({ id: "1", slug: "online-slots", title: "Online Slots Real Money" })];
  const routes = generateRouteManifest(articles, { siteUrl: "https://example.test", permalinkStructure: "/%postname%/" }).manifest;

  const output = buildSeoOutput(dump, articles, routes, { siteUrl: "https://example.test" });

  assert.equal(output.metadata[0].title, "Untitled");
  assert.equal(output.metadata[0].noindex, true);
  assert.equal(output.sitemapXml.includes("online-slots"), false);
  assert.equal(output.rssXml.includes("online-slots"), false);
  assert.equal(output.review.some((entry) => entry.reason.includes("Suspicious SEO/content signals")), true);
});

function article(overrides: Partial<SanitizedArticle>): SanitizedArticle {
  return {
    id: "1",
    type: "post",
    status: "publish",
    title: "Published Post",
    slug: "published-post",
    publishedAt: "2020-01-01 12:00:00",
    modifiedAt: "2020-01-02 12:00:00",
    authorId: "1",
    pathname: "/published-post/",
    sanitizedContent: "<p>This is a useful article about home robots and cleaning.</p>",
    ...overrides,
  };
}
