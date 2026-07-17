import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContentBundle, writeContentBundle } from "../src/content-model.js";

test("builds a validated article bundle from linked content, SEO metadata, and routes", () => {
  const bundle = buildContentBundle([linkedPost()], [seoPost()], [route()]);

  assert.equal(bundle.articles.length, 1);
  assert.equal(bundle.pages.length, 0);
  assert.equal(bundle.authors.length, 1);
  assert.equal(bundle.categories[0].slug, "smart-cleaning");
  assert.equal(bundle.articles[0].status, "published");
  assert.equal(bundle.articles[0].content.kind, "html");
  assert.equal(bundle.articles[0].seo.canonicalPath, "/clean-home/");
});

test("maps recovered featured media to approved local image variants", () => {
  const bundle = buildContentBundle([linkedPostWithFeaturedMedia()], [seoPost()], [route()], {
    mediaAccepted: mediaAccepted(),
  });

  assert.equal(bundle.articles.length, 1);
  assert.equal(bundle.articles[0].featuredImage?.src, "/media/2020/01/hero.webp");
  assert.equal(bundle.articles[0].featuredImage?.width, 1200);
  assert.equal(bundle.articles[0].featuredImage?.alt, "Hero alt text");
  assert.equal(bundle.articles[0].featuredImage?.variants?.thumbnail?.src, "/media/2020/01/hero-150x150.webp");
  assert.equal(bundle.articles[0].featuredImage?.variants?.card?.src, "/media/2020/01/hero-300x200.webp");
  assert.equal(bundle.articles[0].seo.ogImage, "/media/2020/01/hero.webp");
});

test("excludes noindex content by default and can include it explicitly", () => {
  const seo = { ...seoPost(), noindex: true };
  const excluded = buildContentBundle([linkedPost()], [seo], [route()]);
  const included = buildContentBundle([linkedPost()], [seo], [route()], { includeNoindex: true });

  assert.equal(excluded.articles.length, 0);
  assert.equal(excluded.reports.excludedContent.length, 1);
  assert.equal(included.articles.length, 1);
});

test("excludes unsafe executable content during schema validation", () => {
  const bundle = buildContentBundle([{ ...linkedPost(), sanitizedContent: '<p><a href="javascript:alert(1)">bad</a></p>' }], [seoPost()], [route()]);

  assert.equal(bundle.articles.length, 0);
  assert.equal(bundle.reports.excludedContent.length, 1);
  assert.match(bundle.reports.validationWarnings[0].reason, /Safe content contains executable/);
});

test("writes file-based content collections and summary", () => {
  const dir = mkdtempSync(join(tmpdir(), "content-model-"));

  try {
    const summary = writeContentBundle(dir, buildContentBundle([linkedPost()], [seoPost()], [route()]));
    const article = JSON.parse(readFileSync(join(dir, "articles", "clean-home-1.json"), "utf8")) as { pathname: string };

    assert.equal(summary.articles, 1);
    assert.equal(article.pathname, "/clean-home/");
    assert.ok(readFileSync(join(dir, "content-bundle.json"), "utf8").includes('"articles"'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function linkedPost() {
  return {
    id: "1",
    type: "post",
    status: "publish",
    title: "Clean Home",
    slug: "clean-home",
    publishedAt: "2020-01-01 10:00:00",
    modifiedAt: "2020-01-02 10:00:00",
    authorId: "10",
    pathname: "/clean-home/",
    sanitizedContent: "<p>Safe content.</p>",
  };
}

function linkedPostWithFeaturedMedia() {
  return {
    ...linkedPost(),
    featuredMedia: {
      attachmentId: "4",
      sourcePath: "2020/01/hero.jpg",
      width: 1200,
      height: 800,
      alt: "Hero alt text",
      sizes: [
        {
          name: "thumbnail",
          sourcePath: "2020/01/hero-150x150.jpg",
          width: 150,
          height: 150,
        },
        {
          name: "medium",
          sourcePath: "2020/01/hero-300x200.jpg",
          width: 300,
          height: 200,
        },
      ],
    },
  };
}

function mediaAccepted() {
  return [
    {
      originalPath: "2020/01/hero.jpg",
      outputPath: "media/2020/01/hero.webp",
      width: 1200,
      height: 800,
    },
    {
      originalPath: "2020/01/hero-150x150.jpg",
      outputPath: "media/2020/01/hero-150x150.webp",
      width: 150,
      height: 150,
    },
    {
      originalPath: "2020/01/hero-300x200.jpg",
      outputPath: "media/2020/01/hero-300x200.webp",
      width: 300,
      height: 200,
    },
  ];
}

function seoPost() {
  return {
    id: "1",
    pathname: "/clean-home/",
    type: "post",
    title: "Clean Home",
    description: "A practical home guide.",
    canonicalPath: "/clean-home/",
    openGraph: {},
    author: {
      id: "10",
      name: "Andre",
      slug: "andre",
    },
    categories: [
      {
        id: "20",
        name: "Smart Cleaning",
        slug: "smart-cleaning",
      },
    ],
    tags: [],
    noindex: false,
  };
}

function route() {
  return {
    postId: "1",
    originalAbsoluteUrl: "https://example.test/clean-home/",
    originalPathname: "/clean-home/",
    newPathname: "/clean-home/",
    contentType: "post",
    httpStatusExpectation: "200",
    canonicalPath: "/clean-home/",
    redirectRequired: false,
    reviewRequired: false,
    reviewReasons: [],
  };
}
