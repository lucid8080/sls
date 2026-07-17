import { siteUrl } from "@/lib/content";

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
const SHORTCODE_RE =
  /\[(?!caption\b|gallery\b|embed\b|table\b|amazon\b|\/caption\b|\/gallery\b|\/embed\b|\/table\b|\/amazon\b)[a-zA-Z][\w-]*(?:\s+[^\]]*)?\]/g;
const TOKEN_RE = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[a-zA-Z][^>]*>/g;

export type SanitizeReport = {
  reason: string;
  preview: string;
  severity: "low" | "medium" | "high";
};

export type SanitizeResult = {
  html: string;
  reports: SanitizeReport[];
};

export function sanitizeCmsHtml(
  html: string,
  context: { id?: string; title?: string; pathname?: string } = {},
): SanitizeResult {
  const reports: SanitizeReport[] = [];
  const sanitizerContext: SanitizerContext = {
    postId: context.id ?? "cms-draft",
    postTitle: context.title ?? "CMS draft",
    originalPath: context.pathname ?? "/",
    siteHost: hostFromUrl(siteUrl),
  };

  const sanitized = sanitizeHtml(html, sanitizerContext, reports);
  return { html: sanitized, reports };
}

function sanitizeHtml(html: string, context: SanitizerContext, reports: SanitizeReport[]): string {
  let output = "";
  let cursor = 0;
  let dropUntilTag: string | undefined;

  if (EXECUTABLE_TEXT_RE.test(html)) {
    addReport(reports, "Executable-looking content detected in raw HTML.", html, "high");
  }

  for (const match of html.matchAll(TOKEN_RE)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (!dropUntilTag) {
      output += escapeText(html.slice(cursor, index));
    }

    cursor = index + token.length;

    if (token.startsWith("<!--")) {
      if (!/wp:/.test(token)) {
        addReport(reports, "HTML comment removed.", token, "low");
      }
      continue;
    }

    if (token.startsWith("<?")) {
      addReport(reports, "PHP fragment removed from article HTML.", token, "high");
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
      addReport(reports, `Removed unsafe <${tag.name}> block.`, token, "high");
      if (!tag.selfClosing) {
        dropUntilTag = tag.name;
      }
      continue;
    }

    if (DROP_TAG_ONLY.has(tag.name)) {
      addReport(reports, `Removed unsafe <${tag.name}> tag.`, token, "high");
      continue;
    }

    if (!ALLOWED_TAGS.has(tag.name)) {
      addReport(reports, `Removed unsupported <${tag.name}> tag.`, token, "medium");
      continue;
    }

    const sanitizedAttrs = sanitizeAttributes(tag.name, tag.attributes, reports);
    if (sanitizedAttrs === "drop-element") {
      addReport(reports, `Removed suspicious <${tag.name}> element.`, token, "high");
      continue;
    }

    output += `<${tag.name}${sanitizedAttrs.length ? ` ${sanitizedAttrs.join(" ")}` : ""}>`;
  }

  if (!dropUntilTag) {
    output += escapeText(html.slice(cursor));
  }

  return removeShortcodes(output, reports).trim();
}

function sanitizeAttributes(
  tagName: string,
  attributes: Attribute[],
  reports: SanitizeReport[],
): string[] | "drop-element" {
  const output: string[] = [];
  const width = numberAttr(attributes, "width");
  const height = numberAttr(attributes, "height");

  if (tagName === "img" && width !== undefined && height !== undefined && width <= 1 && height <= 1) {
    addReport(reports, "Removed likely tracking pixel image.", `<img width="${width}" height="${height}">`, "high");
    return "drop-element";
  }

  for (const attribute of attributes) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith("on")) {
      addReport(reports, `Removed inline event handler '${name}'.`, `${name}="${value}"`, "high");
      continue;
    }

    if (name === "style") {
      addReport(reports, "Removed inline style attribute.", value, /expression|display\s*:\s*none|visibility\s*:\s*hidden/i.test(value) ? "high" : "medium");
      continue;
    }

    if (tagName === "a" && name === "href") {
      const sanitizedUrl = sanitizeUrl(value, reports);
      if (sanitizedUrl) {
        output.push(`href="${escapeAttribute(sanitizedUrl)}"`);
      }
      continue;
    }

    if (tagName === "img" && name === "src") {
      const sanitizedUrl = sanitizeUrl(value, reports);
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

    if (tagName === "a" && name === "title") {
      output.push(`${name}="${escapeAttribute(value)}"`);
      continue;
    }

    if ((tagName === "td" || tagName === "th") && ["colspan", "rowspan"].includes(name)) {
      output.push(`${name}="${escapeAttribute(value)}"`);
      continue;
    }
  }

  if (tagName === "a" && output.some((attr) => attr.startsWith("href="))) {
    output.push('rel="noopener noreferrer"');
  }

  return output;
}

function sanitizeUrl(value: string, reports: SanitizeReport[]): string | undefined {
  const trimmed = value.trim().split("").filter((char) => {
    const code = char.charCodeAt(0);
    return code > 31 && code !== 127 && !/\s/.test(char);
  }).join("");

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
    addReport(reports, "Removed malformed URL.", value, "medium");
    return undefined;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    addReport(reports, `Removed URL with disallowed protocol '${parsed.protocol}'.`, value, "high");
    return undefined;
  }

  if (SUSPICIOUS_DOMAIN_RE.test(parsed.hostname)) {
    addReport(reports, "Suspicious external domain requires manual review.", value, "high");
  }

  return parsed.toString();
}

function removeShortcodes(html: string, reports: SanitizeReport[]): string {
  return html.replace(SHORTCODE_RE, (shortcode) => {
    addReport(reports, "Unknown shortcode removed.", shortcode, "medium");
    return "";
  });
}

function parseTag(token: string):
  | { name: string; closing: boolean; selfClosing: boolean; attributes: Attribute[] }
  | undefined {
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

function hostFromUrl(site: string): string | undefined {
  try {
    return new URL(site).hostname;
  } catch {
    return undefined;
  }
}

function addReport(
  reports: SanitizeReport[],
  reason: string,
  previewSource: string,
  severity: SanitizeReport["severity"],
): void {
  reports.push({
    reason,
    preview: previewSource.replace(/\s+/g, " ").slice(0, 180),
    severity,
  });
}

function normalizeDoubleEncodedAmps(value: string): string {
  let result = value;
  while (/&amp;amp;/i.test(result)) {
    result = result.replace(/&amp;amp;/gi, "&amp;");
  }
  return result;
}

function escapeText(value: string): string {
  return normalizeDoubleEncodedAmps(value)
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}
