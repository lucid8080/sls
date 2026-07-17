import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RouteManifestEntry } from "./route.js";
import { SanitizedArticle } from "./sanitize.js";

export type BrokenInternalLink = {
  postId: string;
  postTitle: string;
  postPathname: string;
  href: string;
  normalizedPath?: string;
  reason: string;
  preview: string;
  severity: "low" | "medium" | "high";
  manualReview: boolean;
};

export type SuspiciousExternalLink = {
  postId: string;
  postTitle: string;
  postPathname: string;
  href: string;
  reason: string;
  preview: string;
  severity: "low" | "medium" | "high";
  manualReview: boolean;
};

export type LinkRewriteResult = {
  content: SanitizedArticle[];
  reports: {
    brokenInternalLinks: BrokenInternalLink[];
    suspiciousExternalLinks: SuspiciousExternalLink[];
  };
  summary: {
    rewrittenInternalLinks: number;
    preservedExternalLinks: number;
    brokenInternalLinks: number;
    suspiciousExternalLinks: number;
  };
};

export type LinkRewriteOptions = {
  siteUrl: string;
  mediaPrefix?: string;
};

const HREF_RE = /\bhref="([^"]*)"/gi;
const SRC_RE = /\bsrc="([^"]*)"/gi;
const SUSPICIOUS_EXTERNAL_RE =
  /\b(casino|pokies?|slots?|blackjack|gambling|bonus codes?|real money|porn|viagra|cialis|levitra|pharma|loan|betting|hitclub|doctiplus)\b/i;

export function readArticles(path: string): SanitizedArticle[] {
  return JSON.parse(readFileSync(path, "utf8")) as SanitizedArticle[];
}

export function rewriteInternalLinks(
  articles: SanitizedArticle[],
  routes: RouteManifestEntry[],
  options: LinkRewriteOptions,
): LinkRewriteResult {
  const site = new URL(options.siteUrl);
  const routeMap = buildRouteMap(routes);
  const postIdMap = buildPostIdMap(routes);
  const result: LinkRewriteResult = {
    content: [],
    reports: {
      brokenInternalLinks: [],
      suspiciousExternalLinks: [],
    },
    summary: {
      rewrittenInternalLinks: 0,
      preservedExternalLinks: 0,
      brokenInternalLinks: 0,
      suspiciousExternalLinks: 0,
    },
  };

  for (const article of articles) {
    let sanitizedContent = article.sanitizedContent;
    sanitizedContent = rewriteAttribute(sanitizedContent, HREF_RE, article, site, routeMap, postIdMap, result, "href", options);
    sanitizedContent = rewriteAttribute(sanitizedContent, SRC_RE, article, site, routeMap, postIdMap, result, "src", options);
    result.content.push({ ...article, sanitizedContent });
  }

  result.summary.brokenInternalLinks = result.reports.brokenInternalLinks.length;
  result.summary.suspiciousExternalLinks = result.reports.suspiciousExternalLinks.length;

  return result;
}

export function writeLinkOutput(outputDir: string, result: LinkRewriteResult): void {
  mkdirSync(join(outputDir, "reports"), { recursive: true });
  writeJson(join(outputDir, "linked-content.json"), result.content);
  writeJson(join(outputDir, "summary.json"), result.summary);
  writeJson(join(outputDir, "reports", "broken-internal-links.json"), result.reports.brokenInternalLinks);
  writeJson(join(outputDir, "reports", "suspicious-external-links.json"), result.reports.suspiciousExternalLinks);
}

export function writeLinkOutputToProject(projectRoot: string, result: LinkRewriteResult): void {
  mkdirSync(join(projectRoot, "data"), { recursive: true });
  mkdirSync(join(projectRoot, "reports"), { recursive: true });
  writeJson(join(projectRoot, "data", "linked-content.json"), result.content);
  writeJson(join(projectRoot, "data", "link-summary.json"), result.summary);
  writeJson(join(projectRoot, "reports", "broken-internal-links.json"), result.reports.brokenInternalLinks);
  writeJson(join(projectRoot, "reports", "suspicious-external-links.json"), result.reports.suspiciousExternalLinks);
}

function rewriteAttribute(
  html: string,
  pattern: RegExp,
  article: SanitizedArticle,
  site: URL,
  routeMap: Map<string, string>,
  postIdMap: Map<string, string>,
  result: LinkRewriteResult,
  attribute: "href" | "src",
  options: LinkRewriteOptions,
): string {
  return html.replace(pattern, (full, rawValue: string) => {
    const rewritten = rewriteUrl(rawValue, article, site, routeMap, postIdMap, result, attribute, options);
    return `${attribute}="${escapeAttribute(rewritten)}"`;
  });
}

function rewriteUrl(
  rawValue: string,
  article: SanitizedArticle,
  site: URL,
  routeMap: Map<string, string>,
  postIdMap: Map<string, string>,
  result: LinkRewriteResult,
  attribute: "href" | "src",
  options: LinkRewriteOptions,
): string {
  const decodedValue = decodeHtmlAttribute(rawValue);
  const normalized = normalizeLink(decodedValue, site, article.pathname);

  if (normalized.kind === "anchor" || normalized.kind === "mailto" || normalized.kind === "tel") {
    return decodedValue;
  }

  if (normalized.kind === "external") {
    if (isWordPressAdminUrl(normalized.href)) {
      result.reports.suspiciousExternalLinks.push(
        externalReport(article, normalized.href, "External WordPress admin/login URL must not be preserved as a live link.", "high"),
      );
      return "#";
    }

    result.summary.preservedExternalLinks += 1;
    if (SUSPICIOUS_EXTERNAL_RE.test(normalized.href)) {
      result.reports.suspiciousExternalLinks.push(externalReport(article, normalized.href, "Suspicious external domain or path requires manual review.", "high"));
    }
    return decodedValue;
  }

  if (normalized.kind === "media") {
    const mediaPath = rewriteMediaPath(normalized.pathname, options.mediaPrefix ?? "/media/");
    result.summary.rewrittenInternalLinks += mediaPath === decodedValue ? 0 : 1;
    return withHash(mediaPath, normalized.hash);
  }

  if (normalized.kind !== "internal") {
    return decodedValue;
  }

  const normalizedTarget = normalized.queryPostId ? `${normalized.pathname}?p=${normalized.queryPostId}` : `${normalized.pathname}${normalized.search}`;
  const isAdminTarget = isWordPressAdminUrl(normalizedTarget);
  if (isAdminTarget) {
    result.reports.brokenInternalLinks.push(
      brokenReport(
        article,
        decodedValue,
        normalizedTarget,
        `Internal ${attribute} points to an old WordPress admin URL and must not be migrated.`,
        "high",
      ),
    );
    return "#";
  }

  const destination = normalized.queryPostId
    ? postIdMap.get(normalized.queryPostId)
    : normalized.pathname === "/" && !normalized.search
      ? "/"
      : routeMap.get(normalized.pathname);
  if (!destination) {
    result.reports.brokenInternalLinks.push(
      brokenReport(
        article,
        decodedValue,
        normalizedTarget,
        `Internal ${attribute} target does not exist in route manifest.`,
        "medium",
      ),
    );
    return decodedValue;
  }

  result.summary.rewrittenInternalLinks += destination === decodedValue ? 0 : 1;
  return withHash(destination, normalized.hash);
}

function normalizeLink(
  href: string,
  site: URL,
  currentPathname: string,
):
  | { kind: "anchor" | "mailto" | "tel"; href: string }
  | { kind: "external"; href: string }
  | { kind: "internal" | "media"; pathname: string; hash: string; search: string; queryPostId?: string } {
  const trimmed = href.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return { kind: "anchor", href };
  }

  if (/^mailto:/i.test(trimmed)) {
    return { kind: "mailto", href };
  }

  if (/^tel:/i.test(trimmed)) {
    return { kind: "tel", href };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, new URL(currentPathname, site));
  } catch {
    return { kind: "external", href };
  }

  const sameHost = equivalentHost(parsed.hostname, site.hostname);
  if (!sameHost) {
    return { kind: "external", href: parsed.toString() };
  }

  const isMedia = parsed.pathname.includes("/wp-content/uploads/") || parsed.pathname.startsWith("/wp-content/uploads/");
  const pathname = isMedia ? parsed.pathname : normalizePathname(parsed.pathname);
  const queryPostId = parsed.searchParams.get("p") ?? parsed.searchParams.get("page_id") ?? undefined;
  const kind = isMedia ? "media" : "internal";
  return { kind, pathname, hash: parsed.hash, search: parsed.search, queryPostId };
}

function buildRouteMap(routes: RouteManifestEntry[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const route of routes) {
    addRouteVariant(map, route.originalPathname, route.newPathname);
    addRouteVariant(map, route.newPathname, route.newPathname);
    addRouteVariant(map, route.canonicalPath, route.newPathname);
  }

  return map;
}

function buildPostIdMap(routes: RouteManifestEntry[]): Map<string, string> {
  return new Map(routes.map((route) => [route.postId, normalizePathname(route.newPathname)]));
}

function addRouteVariant(map: Map<string, string>, source: string, destination: string): void {
  const normalizedSource = normalizePathname(source);
  const normalizedDestination = normalizePathname(destination);
  map.set(normalizedSource, normalizedDestination);

  if (normalizedSource.endsWith("/") && normalizedSource !== "/") {
    map.set(normalizedSource.slice(0, -1), normalizedDestination);
  } else if (normalizedSource !== "/") {
    map.set(`${normalizedSource}/`, normalizedDestination);
  }
}

function normalizePathname(pathname: string): string {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }

  const encoded = decoded
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const clean = encoded.startsWith("/") ? encoded : `/${encoded}`;
  const normalized = clean.replace(/\/+/g, "/");
  return normalized === "/" ? "/" : `${normalized.replace(/\/$/, "")}/`;
}

function rewriteMediaPath(pathname: string, mediaPrefix: string): string {
  const marker = "/wp-content/uploads/";
  const index = pathname.indexOf(marker);
  if (index < 0) {
    return pathname;
  }
  const mediaRelative = pathname.slice(index + marker.length);
  const prefix = mediaPrefix.endsWith("/") ? mediaPrefix : `${mediaPrefix}/`;
  return `${prefix}${mediaRelative}`;
}

function equivalentHost(candidate: string, siteHost: string): boolean {
  const normalizedCandidate = candidate.toLowerCase().replace(/^www\./, "");
  const normalizedSite = siteHost.toLowerCase().replace(/^www\./, "");
  return normalizedCandidate === normalizedSite;
}

function isWordPressAdminUrl(value: string): boolean {
  return value.includes("/wp-admin/") || value.includes("wp-login");
}

function withHash(pathname: string, hash: string): string {
  return `${pathname}${hash}`;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function brokenReport(
  article: SanitizedArticle,
  href: string,
  normalizedPath: string,
  reason: string,
  severity: BrokenInternalLink["severity"],
): BrokenInternalLink {
  return {
    postId: article.id,
    postTitle: article.title,
    postPathname: article.pathname,
    href,
    normalizedPath,
    reason,
    preview: preview(href),
    severity,
    manualReview: true,
  };
}

function externalReport(
  article: SanitizedArticle,
  href: string,
  reason: string,
  severity: SuspiciousExternalLink["severity"],
): SuspiciousExternalLink {
  return {
    postId: article.id,
    postTitle: article.title,
    postPathname: article.pathname,
    href,
    reason,
    preview: preview(href),
    severity,
    manualReview: true,
  };
}

function preview(value: string): string {
  return value.replace(/\s+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 180);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
