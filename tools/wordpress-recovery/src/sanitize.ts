import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExtractedContent } from "./types.js";

export type SanitizerReportEntry = {
  postId: string;
  postTitle: string;
  originalPath: string;
  reason: string;
  preview: string;
  severity: "low" | "medium" | "high";
  manualReview: boolean;
};

export type SanitizedArticle = Omit<ExtractedContent["content"][number], "rawContent" | "requiresSanitization"> & {
  pathname: string;
  sanitizedContent: string;
};

export type SanitizedContentResult = {
  sanitizedContent: SanitizedArticle[];
  reports: {
    removedContent: SanitizerReportEntry[];
    suspiciousLinks: SanitizerReportEntry[];
    suspiciousHtml: SanitizerReportEntry[];
  };
};

type SanitizerContext = {
  postId: string;
  postTitle: string;
  originalPath: string;
  siteHost?: string;
};

type Attribute = {
  name: string;
  value: string;
};

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "blockquote",
  "code",
  "pre",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "img",
  "a",
  "hr",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "form", "svg"]);
const DROP_TAG_ONLY = new Set(["input", "button", "textarea", "select", "meta", "link"]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const SUSPICIOUS_DOMAIN_RE = /(casino|porn|viagra|cialis|levitra|pharma|loan|betting|hitclub|doctiplus)/i;
const EXECUTABLE_TEXT_RE = /<\?(?:php)?|eval\s*\(|atob\s*\(|base64_decode\s*\(|data\s*:\s*text\/html/i;
const SHORTCODE_RE = /\[(?!caption\b|gallery\b|embed\b|table\b|amazon\b|\/caption\b|\/gallery\b|\/embed\b|\/table\b|\/amazon\b)[a-zA-Z][\w-]*(?:\s+[^\]]*)?\]/g;
const TOKEN_RE = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[a-zA-Z][^>]*>/g;

export function sanitizeExtractedContent(extraction: ExtractedContent, siteUrl?: string): SanitizedContentResult {
  const result: SanitizedContentResult = {
    sanitizedContent: [],
    reports: {
      removedContent: [],
      suspiciousLinks: [],
      suspiciousHtml: [],
    },
  };
  const siteHost = hostFromUrl(siteUrl);

  for (const article of extraction.content) {
    const { rawContent, requiresSanitization, ...safeArticleFields } = article;
    const context: SanitizerContext = {
      postId: article.id,
      postTitle: article.title,
      originalPath: `/${article.slug}/`,
      siteHost,
    };
    void requiresSanitization;
    const sanitizedContent = sanitizeHtml(rawContent, context, result.reports);
    result.sanitizedContent.push({
      ...safeArticleFields,
      pathname: context.originalPath,
      sanitizedContent,
    });
  }

  return result;
}

export function sanitizeHtml(
  html: string,
  context: SanitizerContext,
  reports: SanitizedContentResult["reports"],
): string {
  let output = "";
  let cursor = 0;
  let dropUntilTag: string | undefined;

  reportSuspiciousRawHtml(html, context, reports);

  for (const match of html.matchAll(TOKEN_RE)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (!dropUntilTag) {
      output += escapeText(html.slice(cursor, index));
    }

    cursor = index + token.length;

    if (token.startsWith("<!--")) {
      handleComment(token, context, reports);
      continue;
    }

    if (token.startsWith("<?")) {
      addReport(reports.removedContent, context, "PHP fragment removed from article HTML.", token, "high");
      continue;
    }

    const tag = parseTag(token);
    if (!tag) {
      if (!dropUntilTag) {
        output += escapeText(token);
      }
      continue;
    }

    if (dropUntilTag) {
      if (tag.closing && tag.name === dropUntilTag) {
        dropUntilTag = undefined;
      }
      continue;
    }

    if (tag.closing) {
      if (ALLOWED_TAGS.has(tag.name) && !VOID_TAGS.has(tag.name)) {
        output += `</${tag.name}>`;
      }
      continue;
    }

    if (DROP_WITH_CONTENT.has(tag.name)) {
      addReport(reports.removedContent, context, `Removed unsafe <${tag.name}> block.`, token, "high");
      if (!tag.selfClosing) {
        dropUntilTag = tag.name;
      }
      continue;
    }

    if (DROP_TAG_ONLY.has(tag.name)) {
      addReport(reports.removedContent, context, `Removed unsafe <${tag.name}> tag.`, token, "high");
      continue;
    }

    if (!ALLOWED_TAGS.has(tag.name)) {
      addReport(reports.removedContent, context, `Removed unsupported <${tag.name}> tag.`, token, "medium");
      continue;
    }

    const sanitizedAttrs = sanitizeAttributes(tag.name, tag.attributes, context, reports);
    if (sanitizedAttrs === "drop-element") {
      addReport(reports.removedContent, context, `Removed suspicious <${tag.name}> element.`, token, "high");
      continue;
    }

    output += `<${tag.name}${sanitizedAttrs.length ? ` ${sanitizedAttrs.join(" ")}` : ""}${VOID_TAGS.has(tag.name) ? "" : ""}>`;
  }

  if (!dropUntilTag) {
    output += escapeText(html.slice(cursor));
  }

  return removeShortcodes(output, context, reports).trim();
}

export function writeSanitizedOutput(outputDir: string, result: SanitizedContentResult): void {
  const reportsDir = join(outputDir, "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeJson(join(outputDir, "sanitized-content.json"), result.sanitizedContent);
  writeJson(join(reportsDir, "removed-content.json"), result.reports.removedContent);
  writeJson(join(reportsDir, "suspicious-links.json"), result.reports.suspiciousLinks);
  writeJson(join(reportsDir, "suspicious-html.json"), result.reports.suspiciousHtml);
}

function sanitizeAttributes(
  tagName: string,
  attributes: Attribute[],
  context: SanitizerContext,
  reports: SanitizedContentResult["reports"],
): string[] | "drop-element" {
  const output: string[] = [];
  const width = numberAttr(attributes, "width");
  const height = numberAttr(attributes, "height");

  if (tagName === "img" && width !== undefined && height !== undefined && width <= 1 && height <= 1) {
    addReport(reports.removedContent, context, "Removed likely tracking pixel image.", `<img width="${width}" height="${height}">`, "high");
    return "drop-element";
  }

  for (const attribute of attributes) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith("on")) {
      addReport(reports.removedContent, context, `Removed inline event handler '${name}'.`, `${name}="${value}"`, "high");
      continue;
    }

    if (name === "style") {
      addReport(reports.removedContent, context, "Removed inline style attribute.", value, /expression|display\s*:\s*none|visibility\s*:\s*hidden/i.test(value) ? "high" : "medium");
      continue;
    }

    if (tagName === "a" && name === "href") {
      const sanitizedUrl = sanitizeUrl(value, context, reports);
      if (sanitizedUrl) {
        output.push(`href="${escapeAttribute(sanitizedUrl)}"`);
      }
      continue;
    }

    if (tagName === "img" && name === "src") {
      const sanitizedUrl = sanitizeUrl(value, context, reports);
      if (!sanitizedUrl) {
        return "drop-element";
      }
      output.push(`src="${escapeAttribute(sanitizedUrl)}"`);
      continue;
    }

    if (tagName === "img" && ["alt", "title", "width", "height"].includes(name)) {
      output.push(`${name}="${escapeAttribute(value)}"`);
      continue;
    }

    if (tagName === "a" && ["title"].includes(name)) {
      output.push(`${name}="${escapeAttribute(value)}"`);
      continue;
    }

    if ((tagName === "td" || tagName === "th") && ["colspan", "rowspan"].includes(name)) {
      output.push(`${name}="${escapeAttribute(value)}"`);
      continue;
    }

    if (["class", "id", "data-", "aria-"].some((prefix) => name === prefix || name.startsWith(prefix))) {
      continue;
    }

    if (name) {
      addReport(reports.removedContent, context, `Removed unsupported attribute '${name}'.`, `${name}="${value}"`, "low");
    }
  }

  if (tagName === "a" && output.some((attr) => attr.startsWith("href="))) {
    output.push('rel="noopener noreferrer"');
  }

  return output;
}

function sanitizeUrl(
  value: string,
  context: SanitizerContext,
  reports: SanitizedContentResult["reports"],
): string | undefined {
  const trimmed = value.trim().replace(/[\u0000-\u001f\u007f\s]+/g, "");

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    addReport(reports.suspiciousLinks, context, "Removed malformed URL.", value, "medium");
    return undefined;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    addReport(reports.suspiciousLinks, context, `Removed URL with disallowed protocol '${parsed.protocol}'.`, value, "high");
    return undefined;
  }

  if (parsed.protocol === "http:") {
    addReport(reports.suspiciousLinks, context, "HTTP URL requires migration review and possible HTTPS upgrade.", value, "medium");
  }

  if (SUSPICIOUS_DOMAIN_RE.test(parsed.hostname)) {
    addReport(reports.suspiciousLinks, context, "Suspicious external domain requires manual review.", value, "high");
  } else if (context.siteHost && parsed.hostname !== context.siteHost && !parsed.hostname.endsWith(`.${context.siteHost}`)) {
    // External links are preserved but logged lightly for later link policy review.
    addReport(reports.suspiciousLinks, context, "External link preserved for manual review.", value, "low");
  }

  return parsed.toString();
}

function reportSuspiciousRawHtml(
  html: string,
  context: SanitizerContext,
  reports: SanitizedContentResult["reports"],
): void {
  if (EXECUTABLE_TEXT_RE.test(html)) {
    addReport(reports.suspiciousHtml, context, "Executable-looking content detected in raw HTML.", html, "high");
  }
}

function handleComment(
  token: string,
  context: SanitizerContext,
  reports: SanitizedContentResult["reports"],
): void {
  if (/wp:/.test(token)) {
    return;
  }

  if (EXECUTABLE_TEXT_RE.test(token) || /script|iframe|javascript:/i.test(token)) {
    addReport(reports.suspiciousHtml, context, "Suspicious HTML comment removed.", token, "high");
    return;
  }

  addReport(reports.removedContent, context, "HTML comment removed.", token, "low");
}

function removeShortcodes(
  html: string,
  context: SanitizerContext,
  reports: SanitizedContentResult["reports"],
): string {
  return html.replace(SHORTCODE_RE, (shortcode) => {
    addReport(reports.removedContent, context, "Unknown shortcode removed.", shortcode, "medium");
    return "";
  });
}

function parseTag(token: string): { name: string; closing: boolean; selfClosing: boolean; attributes: Attribute[] } | undefined {
  const match = token.match(/^<\s*(\/)?\s*([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)\s*>$/);
  if (!match) {
    return undefined;
  }

  return {
    name: match[2].toLowerCase(),
    closing: Boolean(match[1]),
    selfClosing: Boolean(match[4]) || VOID_TAGS.has(match[2].toLowerCase()),
    attributes: parseAttributes(match[3] ?? ""),
  };
}

function parseAttributes(source: string): Attribute[] {
  const attributes: Attribute[] = [];
  const attrRe = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

  for (const match of source.matchAll(attrRe)) {
    attributes.push({
      name: match[1],
      value: match[2] ?? match[3] ?? match[4] ?? "",
    });
  }

  return attributes;
}

function numberAttr(attributes: Attribute[], name: string): number | undefined {
  const raw = attributes.find((attribute) => attribute.name.toLowerCase() === name)?.value;
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hostFromUrl(siteUrl?: string): string | undefined {
  if (!siteUrl) {
    return undefined;
  }
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return undefined;
  }
}

function addReport(
  report: SanitizerReportEntry[],
  context: SanitizerContext,
  reason: string,
  previewSource: string,
  severity: SanitizerReportEntry["severity"],
): void {
  report.push({
    postId: context.postId,
    postTitle: context.postTitle,
    originalPath: context.originalPath,
    reason,
    preview: escapedPreview(previewSource),
    severity,
    manualReview: severity !== "low",
  });
}

function escapedPreview(value: string, limit = 180): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, limit);
}

/** Convert NBSP entities/characters to regular spaces before escaping text nodes. */
export function normalizeNbspEntities(value: string): string {
  return value
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/\u00a0/g, " ");
}

/** Collapse double-encoded ampersands so `&amp;amp;` does not render as visible `&amp;`. */
export function normalizeDoubleEncodedAmps(value: string): string {
  let result = value;
  while (/&amp;amp;/i.test(result)) {
    result = result.replace(/&amp;amp;/gi, "&amp;");
  }
  return result;
}

function escapeText(value: string): string {
  // Normalize NBSP first so WordPress `&nbsp;` does not become visible `&nbsp;` via `&amp;nbsp;`.
  // Collapse double-encoded amps so "A & B" does not become visible "A &amp; B".
  return normalizeDoubleEncodedAmps(normalizeNbspEntities(value))
    .replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
