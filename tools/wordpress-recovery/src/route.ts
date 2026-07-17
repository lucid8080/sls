import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SanitizedArticle } from "./sanitize.js";

export type RouteManifestEntry = {
  postId: string;
  originalAbsoluteUrl: string;
  originalPathname: string;
  newPathname: string;
  contentType: "post" | "page";
  httpStatusExpectation: "200" | "manual-review";
  canonicalPath: string;
  redirectRequired: boolean;
  redirectDestination?: string;
  reviewRequired: boolean;
  reviewReasons: string[];
};

export type RedirectEntry = {
  source: string;
  destination: string;
  permanent: true;
};

export type RouteCollision = {
  pathname: string;
  postIds: string[];
  titles: string[];
};

export type RouteManifestResult = {
  manifest: RouteManifestEntry[];
  redirects: RedirectEntry[];
  collisions: RouteCollision[];
};

export type RouteManifestOptions = {
  siteUrl: string;
  permalinkStructure: string;
  trailingSlash?: boolean;
};

export function readSanitizedArticles(path: string): SanitizedArticle[] {
  return JSON.parse(readFileSync(path, "utf8")) as SanitizedArticle[];
}

export function generateRouteManifest(
  articles: SanitizedArticle[],
  options: RouteManifestOptions,
): RouteManifestResult {
  const trailingSlash = options.trailingSlash ?? true;
  const permalinkStructure = normalizePermalinkStructure(options.permalinkStructure);
  const byId = new Map(articles.map((article) => [article.id, article]));
  const manifest: RouteManifestEntry[] = articles.map((article) => {
    const reviewReasons: string[] = [];
    const originalPathname =
      article.type === "page"
        ? pagePathname(article, byId, trailingSlash, reviewReasons)
        : postPathname(article, permalinkStructure, trailingSlash, reviewReasons);
    const newPathname = originalPathname;

    return {
      postId: article.id,
      originalAbsoluteUrl: absoluteUrl(options.siteUrl, originalPathname),
      originalPathname,
      newPathname,
      contentType: article.type,
      httpStatusExpectation: "200",
      canonicalPath: newPathname,
      redirectRequired: false,
      reviewRequired: reviewReasons.length > 0,
      reviewReasons,
    };
  });

  const collisions = detectCollisions(manifest, articles);
  const collisionPaths = new Set(collisions.map((collision) => collision.pathname));

  for (const entry of manifest) {
    if (collisionPaths.has(entry.newPathname)) {
      entry.httpStatusExpectation = "manual-review";
      entry.reviewRequired = true;
      entry.reviewReasons.push("Route collision: multiple content items resolve to the same pathname.");
    }
  }

  return {
    manifest,
    redirects: redirectsFromManifest(manifest),
    collisions,
  };
}

export function writeRouteOutputs(outputDir: string, result: RouteManifestResult): void {
  mkdirSync(join(outputDir, "reports"), { recursive: true });
  writeJson(join(outputDir, "route-manifest.json"), result.manifest);
  writeJson(join(outputDir, "redirects.json"), result.redirects);
  writeJson(join(outputDir, "reports", "route-collisions.json"), result.collisions);
}

export function writeRouteOutputsToProject(projectRoot: string, result: RouteManifestResult): void {
  const dataDir = join(projectRoot, "data");
  const reportsDir = join(projectRoot, "reports");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });
  writeJson(join(dataDir, "route-manifest.json"), result.manifest);
  writeJson(join(dataDir, "redirects.json"), result.redirects);
  writeJson(join(reportsDir, "route-collisions.json"), result.collisions);
}

function postPathname(
  article: SanitizedArticle,
  permalinkStructure: string,
  trailingSlash: boolean,
  reviewReasons: string[],
): string {
  let path = permalinkStructure || "/%postname%/";
  const published = article.publishedAt ? new Date(`${article.publishedAt.replace(" ", "T")}Z`) : undefined;

  if (path.includes("%category%")) {
    reviewReasons.push("Permalink structure contains %category%, but category route data is not available yet.");
    path = path.replace(/%category%/g, "");
  }

  path = path
    .replace(/%postname%/g, safeSlug(article.slug, reviewReasons))
    .replace(/%year%/g, published && !Number.isNaN(published.getUTCFullYear()) ? String(published.getUTCFullYear()) : "0000")
    .replace(/%monthnum%/g, published && !Number.isNaN(published.getUTCMonth()) ? pad2(published.getUTCMonth() + 1) : "00")
    .replace(/%day%/g, published && !Number.isNaN(published.getUTCDate()) ? pad2(published.getUTCDate()) : "00");

  path = path.replace(/\/+/g, "/");
  return normalizePathname(path, trailingSlash);
}

function pagePathname(
  article: SanitizedArticle,
  byId: Map<string, SanitizedArticle>,
  trailingSlash: boolean,
  reviewReasons: string[],
): string {
  const segments: string[] = [];
  const seen = new Set<string>();
  let current: SanitizedArticle | undefined = article;

  while (current) {
    if (seen.has(current.id)) {
      reviewReasons.push("Page parent cycle detected.");
      break;
    }

    seen.add(current.id);
    segments.unshift(safeSlug(current.slug, reviewReasons));
    current = current.parentId ? byId.get(current.parentId) : undefined;

    if (current && current.type !== "page") {
      reviewReasons.push("Page parent points to non-page content.");
      break;
    }
  }

  return normalizePathname(`/${segments.join("/")}/`, trailingSlash);
}

function detectCollisions(manifest: RouteManifestEntry[], articles: SanitizedArticle[]): RouteCollision[] {
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const byPath = new Map<string, RouteManifestEntry[]>();

  for (const entry of manifest) {
    const existing = byPath.get(entry.newPathname) ?? [];
    existing.push(entry);
    byPath.set(entry.newPathname, existing);
  }

  return [...byPath.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([pathname, entries]) => ({
      pathname,
      postIds: entries.map((entry) => entry.postId),
      titles: entries.map((entry) => articlesById.get(entry.postId)?.title ?? ""),
    }));
}

function redirectsFromManifest(manifest: RouteManifestEntry[]): RedirectEntry[] {
  const redirects: RedirectEntry[] = [];

  for (const entry of manifest) {
    if (!entry.redirectRequired || !entry.redirectDestination) {
      continue;
    }

    if (entry.originalPathname === entry.redirectDestination) {
      entry.reviewRequired = true;
      entry.reviewReasons.push("Redirect loop detected.");
      continue;
    }

    redirects.push({
      source: entry.originalPathname,
      destination: entry.redirectDestination,
      permanent: true,
    });
  }

  return redirects;
}

function absoluteUrl(siteUrl: string, pathname: string): string {
  const url = new URL(siteUrl);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function normalizePathname(pathname: string, trailingSlash: boolean): string {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const withoutDuplicateSlashes = clean.replace(/\/+/g, "/");

  if (withoutDuplicateSlashes === "/") {
    return "/";
  }

  return trailingSlash
    ? `${withoutDuplicateSlashes.replace(/\/$/, "")}/`
    : withoutDuplicateSlashes.replace(/\/$/, "");
}

function safeSlug(slug: string, reviewReasons: string[]): string {
  const trimmed = slug.trim().replace(/^\/+|\/+$/g, "");

  if (!trimmed) {
    reviewReasons.push("Empty slug encountered.");
    return "missing-slug";
  }

  const encoded = trimmed
    .split("/")
    .map((segment) => encodeURIComponent(decodeURIComponentSafe(segment)))
    .join("/");

  if (encoded !== trimmed) {
    reviewReasons.push("Slug required URL encoding normalization.");
  }

  return encoded;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizePermalinkStructure(permalinkStructure: string): string {
  return permalinkStructure.replace(/\^%/g, "%");
}
