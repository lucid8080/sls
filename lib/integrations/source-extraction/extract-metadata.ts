import { extractReadableText, decodeBasicHtmlEntities } from "./extract-readable-text";
import type { ExtractedSourceMetadata, SafeFetchResult } from "./types";

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s"'=<>`]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeBasicHtmlEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    ).trim();
  }
  return attributes;
}

function bounded(value: string | undefined, max: number): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function safeAbsoluteUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString().slice(0, 2048)
      : undefined;
  } catch {
    return undefined;
  }
}

export function extractSourceMetadata(
  fetched: SafeFetchResult,
  options?: { maxExtractedChars?: number },
): ExtractedSourceMetadata {
  const html = fetched.body;
  const meta = new Map<string, string>();

  for (const tag of html.match(/<meta\b[^>]{0,4000}>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property || attributes.name || attributes.itemprop)?.toLowerCase();
    const value = attributes.content;
    if (key && value && !meta.has(key)) meta.set(key, value);
  }

  const titleTag = html.match(/<title\b[^>]*>([\s\S]{0,1000}?)<\/title>/i)?.[1];
  const linkTags = html.match(/<link\b[^>]{0,4000}>/gi) ?? [];
  let canonicalUrl: string | undefined;
  for (const tag of linkTags) {
    const attributes = parseAttributes(tag);
    if (attributes.rel?.toLowerCase().split(/\s+/).includes("canonical")) {
      canonicalUrl = safeAbsoluteUrl(attributes.href, fetched.finalUrl);
      break;
    }
  }

  const rawMetadata: Record<string, string> = {};
  for (const key of [
    "og:type",
    "og:site_name",
    "twitter:card",
    "twitter:site",
    "article:section",
  ]) {
    const value = bounded(meta.get(key), 300);
    if (value) rawMetadata[key] = value;
  }

  const publishedRaw =
    meta.get("article:published_time") ||
    meta.get("datepublished") ||
    meta.get("date") ||
    meta.get("pubdate");
  const publishedDate = publishedRaw ? new Date(publishedRaw) : null;

  return {
    finalUrl: fetched.finalUrl,
    canonicalUrl,
    pageTitle: bounded(
      meta.get("og:title") || meta.get("twitter:title") || decodeBasicHtmlEntities(titleTag ?? ""),
      300,
    ),
    pageDescription: bounded(
      meta.get("og:description") ||
        meta.get("twitter:description") ||
        meta.get("description"),
      1000,
    ),
    authorName: bounded(meta.get("author") || meta.get("article:author"), 200),
    thumbnailUrl: safeAbsoluteUrl(
      meta.get("og:image") || meta.get("twitter:image") || meta.get("twitter:image:src"),
      fetched.finalUrl,
    ),
    publishedAt:
      publishedDate && !Number.isNaN(publishedDate.valueOf())
        ? publishedDate.toISOString()
        : undefined,
    extractedText: extractReadableText(
      html,
      options?.maxExtractedChars ?? 50_000,
    ),
    rawMetadata,
  };
}
