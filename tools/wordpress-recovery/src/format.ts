import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractContent } from "./extract.js";
import { expandProductDisplayShortcodes } from "./product-display.js";
import { sanitizeExtractedContent, SanitizedContentResult, SanitizerReportEntry, writeSanitizedOutput } from "./sanitize.js";
import { ParsedWordPressDump, ExtractedContent } from "./types.js";

export type FormattingReportEntry = SanitizerReportEntry & {
  shortcode?: string;
};

export type FormattingResult = {
  extraction: ExtractedContent;
  reports: {
    unknownShortcodes: FormattingReportEntry[];
    formattingWarnings: FormattingReportEntry[];
  };
};

type FormattingContext = {
  postId: string;
  postTitle: string;
  originalPath: string;
};

export type FormattingOptions = {
  tablepressIds?: Set<string>;
  aawpIds?: Set<string>;
};

const GUTENBERG_COMMENT_RE = /<!--\s*\/?wp:[\s\S]*?-->/g;
const CAPTION_RE = /\[caption\b([^\]]*)\]([\s\S]*?)\[\/caption\]/gi;
const GALLERY_RE = /\[gallery\b[^\]]*\]/gi;
const EMBED_RE = /\[embed\b[^\]]*\]([\s\S]*?)\[\/embed\]/gi;
const IFRAME_RE = /<iframe\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>(?:[\s\S]*?<\/iframe>)?/gi;
const UNKNOWN_SHORTCODE_RE = /\[(\/?)([a-zA-Z][\w-]*)(?:\s+[^\]]*)?\]/g;
const KNOWN_SHORTCODES = new Set(["caption", "gallery", "embed", "table", "amazon"]);

export function convertWordPressFormatting(
  extraction: ExtractedContent,
  options: FormattingOptions = {},
): FormattingResult {
  const result: FormattingResult = {
    extraction: {
      ...extraction,
      content: [],
    },
    reports: {
      unknownShortcodes: [],
      formattingWarnings: [],
    },
  };

  const tablepressIds = options.tablepressIds ?? new Set<string>();
  const aawpIds = options.aawpIds ?? new Set<string>();

  for (const article of extraction.content) {
    const context: FormattingContext = {
      postId: article.id,
      postTitle: article.title,
      originalPath: `/${article.slug}/`,
    };

    result.extraction.content.push({
      ...article,
      rawContent: convertHtml(article.rawContent, context, result.reports, tablepressIds, aawpIds),
    });
  }

  return result;
}

export function formatAndSanitizeDump(
  dump: ParsedWordPressDump,
  siteUrl?: string,
): { formatting: FormattingResult; sanitized: SanitizedContentResult } {
  const knownIds = collectKnownProductDisplayIds(dump);
  const formatting = convertWordPressFormatting(extractContent(dump), knownIds);
  const sanitized = sanitizeExtractedContent(formatting.extraction, siteUrl);
  return { formatting, sanitized };
}

export function collectKnownProductDisplayIds(dump: ParsedWordPressDump): FormattingOptions {
  const tablepressIds = new Set<string>();
  const aawpIds = new Set<string>();

  const tablesOption = dump.records.options.find((row) => (row.option_name ?? "") === "tablepress_tables");
  if (tablesOption?.option_value) {
    try {
      const parsed = JSON.parse(tablesOption.option_value) as { table_post?: Record<string, unknown> };
      for (const id of Object.keys(parsed.table_post ?? {})) {
        tablepressIds.add(id);
      }
    } catch {
      // ignore
    }
  }

  for (const post of dump.records.posts) {
    if ((post.post_type ?? "") === "aawp_table" && post.ID) {
      aawpIds.add(post.ID);
    }
  }

  return { tablepressIds, aawpIds };
}

export function writeFormattedOutput(
  outputDir: string,
  formatted: { formatting: FormattingResult; sanitized: SanitizedContentResult },
): void {
  writeSanitizedOutput(outputDir, formatted.sanitized);

  const reportsDir = join(outputDir, "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeJson(join(reportsDir, "unknown-shortcodes.json"), formatted.formatting.reports.unknownShortcodes);
  writeJson(join(reportsDir, "formatting-warnings.json"), formatted.formatting.reports.formattingWarnings);
}

function convertHtml(
  html: string,
  context: FormattingContext,
  reports: FormattingResult["reports"],
  tablepressIds: Set<string>,
  aawpIds: Set<string>,
): string {
  const withProductDisplays = expandProductDisplayShortcodes(
    html
      .replace(GUTENBERG_COMMENT_RE, "")
      .replace(CAPTION_RE, (_match, attrs: string, inner: string) => convertCaption(attrs, inner, context, reports))
      .replace(GALLERY_RE, (shortcode) => convertGallery(shortcode, context, reports))
      .replace(EMBED_RE, (_match, url: string) => convertEmbed(url, context, reports))
      .replace(IFRAME_RE, (_match, doubleQuoted: string, singleQuoted: string, bare: string) =>
        convertIframe(doubleQuoted || singleQuoted || bare, context, reports),
      ),
    context,
    reports,
    tablepressIds,
    aawpIds,
  );

  return withProductDisplays.replace(UNKNOWN_SHORTCODE_RE, (shortcode, closing: string, name: string) => {
    const normalizedName = name.toLowerCase();
    if (KNOWN_SHORTCODES.has(normalizedName)) {
      return "";
    }

    addShortcodeReport(reports.unknownShortcodes, context, shortcode, `Unknown shortcode '${normalizedName}' removed.`, "medium");
    return closing ? "" : '<p><em>Migration note: unsupported shortcode removed for manual review.</em></p>';
  });
}

function convertCaption(
  attrs: string,
  inner: string,
  context: FormattingContext,
  reports: FormattingResult["reports"],
): string {
  const imageMatch = inner.match(/<img\b[^>]*>/i);

  if (!imageMatch) {
    addShortcodeReport(reports.formattingWarnings, context, `[caption${attrs}]`, "Caption shortcode did not contain an image.", "medium");
    return `<figure><figcaption>${escapeText(stripTags(inner).trim())}</figcaption></figure>`;
  }

  const image = imageMatch[0];
  const captionText = stripTags(inner.replace(image, "")).trim();
  const figcaption = captionText ? `<figcaption>${escapeText(captionText)}</figcaption>` : "";
  return `<figure>${image}${figcaption}</figure>`;
}

function convertGallery(
  shortcode: string,
  context: FormattingContext,
  reports: FormattingResult["reports"],
): string {
  addShortcodeReport(reports.formattingWarnings, context, shortcode, "Gallery shortcode converted to manual-review placeholder.", "medium");
  return '<blockquote><p>Gallery requires manual review during migration.</p></blockquote>';
}

function convertEmbed(
  rawUrl: string,
  context: FormattingContext,
  reports: FormattingResult["reports"],
): string {
  const url = rawUrl.trim();
  const canonical = canonicalEmbedUrl(url);

  if (!canonical) {
    addShortcodeReport(reports.formattingWarnings, context, `[embed]${rawUrl}[/embed]`, "Embed shortcode URL could not be converted safely.", "medium");
    return "";
  }

  return `<p><a href="${escapeAttribute(canonical)}">${escapeText(canonical)}</a></p>`;
}

function convertIframe(
  rawSrc: string,
  context: FormattingContext,
  reports: FormattingResult["reports"],
): string {
  const canonical = canonicalEmbedUrl(rawSrc);

  if (!canonical) {
    addShortcodeReport(reports.formattingWarnings, context, `<iframe src="${rawSrc}">`, "Iframe removed because it could not be converted to a safe canonical link.", "high");
    return "";
  }

  addShortcodeReport(reports.formattingWarnings, context, `<iframe src="${rawSrc}">`, "Iframe converted to a safe canonical link.", "medium");
  return `<p><a href="${escapeAttribute(canonical)}">${escapeText(canonical)}</a></p>`;
}

function canonicalEmbedUrl(rawUrl: string): string | undefined {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
  } catch {
    return undefined;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return undefined;
  }

  const host = parsed.hostname.toLowerCase();

  if (host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
    const embedMatch = parsed.pathname.match(/^\/embed\/([^/?#]+)/);
    const videoId = embedMatch?.[1] ?? parsed.searchParams.get("v");
    return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : parsed.toString();
  }

  if (host === "youtu.be") {
    const videoId = parsed.pathname.replace(/^\//, "").split("/")[0];
    return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : parsed.toString();
  }

  if (host === "player.vimeo.com") {
    const videoId = parsed.pathname.match(/\/video\/([^/?#]+)/)?.[1];
    return videoId ? `https://vimeo.com/${encodeURIComponent(videoId)}` : parsed.toString();
  }

  return parsed.toString();
}

function addShortcodeReport(
  report: FormattingReportEntry[],
  context: FormattingContext,
  shortcode: string,
  reason: string,
  severity: FormattingReportEntry["severity"],
): void {
  report.push({
    postId: context.postId,
    postTitle: context.postTitle,
    originalPath: context.originalPath,
    reason,
    shortcode: shortcode.replace(/\s+/g, " ").slice(0, 80),
    preview: escapeText(shortcode.replace(/\s+/g, " ").slice(0, 180)),
    severity,
    manualReview: true,
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
