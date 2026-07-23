export const EXPECTED_AMAZON_AFFILIATE_TAG = "sls0fa-20";

export type AffiliateNetwork = "amazon" | "other";
export type AffiliateTagStatus = "ok" | "missing_tag" | "not_applicable";

export type ParsedAffiliateLink = {
  url: string;
  normalizedUrl: string;
  network: AffiliateNetwork;
  asin: string | null;
  affiliateTag: string | null;
  tagStatus: AffiliateTagStatus;
  anchorText: string | null;
};

const OTHER_AFFILIATE_HOSTS = [
  "shareasale.com",
  "www.shareasale.com",
  "click.linksynergy.com",
  "www.anrdoezrs.net",
  "go.skimresources.com",
  "homedepot.sjv.io",
  "walmart.marketplace.walmart.com",
];

const HREF_RE = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const ASIN_PATH_RE = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;
const TAG_RE = /(?:^|[?&])tag=([^&]+)/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function isAmazonHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "amzn.to" ||
    host === "www.amzn.to" ||
    host === "amazon.com" ||
    host.endsWith(".amazon.com") ||
    /^amazon\.[a-z.]+$/i.test(host) ||
    /^www\.amazon\.[a-z.]+$/i.test(host)
  );
}

function isOtherAffiliateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return OTHER_AFFILIATE_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

export function extractAsin(urlOrPath: string): string | null {
  const match = urlOrPath.match(ASIN_PATH_RE);
  return match?.[1]?.toUpperCase() ?? null;
}

export function extractAffiliateTag(url: string): string | null {
  try {
    const parsed = new URL(url);
    const tag = parsed.searchParams.get("tag");
    if (tag?.trim()) return tag.trim();
  } catch {
    // fall through to regex for relative/malformed
  }
  const match = url.match(TAG_RE);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function computeTagStatus(
  network: AffiliateNetwork,
  affiliateTag: string | null,
  expectedTag = EXPECTED_AMAZON_AFFILIATE_TAG,
): AffiliateTagStatus {
  if (network !== "amazon") return "not_applicable";
  if (affiliateTag && affiliateTag.toLowerCase() === expectedTag.toLowerCase()) return "ok";
  return "missing_tag";
}

/**
 * Canonical key for deduping Amazon product links: scheme+host+/dp/ASIN (+tag when present for status).
 * Short links (amzn.to) keep the short URL path as the key until expanded by a live check.
 */
export function normalizeAffiliateUrl(rawUrl: string): {
  url: string;
  normalizedUrl: string;
  network: AffiliateNetwork;
  asin: string | null;
  affiliateTag: string | null;
  tagStatus: AffiliateTagStatus;
} | null {
  const trimmed = decodeHtmlEntities(rawUrl.trim());
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("mailto:")) {
    return null;
  }

  let absolute = trimmed;
  if (trimmed.startsWith("//")) {
    absolute = `https:${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(absolute);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isAmazon = isAmazonHost(hostname);
  const isOther = isOtherAffiliateHost(hostname);

  if (!isAmazon && !isOther) {
    return null;
  }

  const network: AffiliateNetwork = isAmazon ? "amazon" : "other";
  const asin = isAmazon ? extractAsin(`${parsed.pathname}${parsed.search}`) : null;
  const affiliateTag = extractAffiliateTag(parsed.toString());
  const tagStatus = computeTagStatus(network, affiliateTag);

  let normalizedUrl: string;
  if (isAmazon && asin) {
    const useHost =
      hostname === "amzn.to" || hostname === "www.amzn.to"
        ? hostname
        : hostname.startsWith("www.")
          ? hostname
          : `www.${hostname}`;
    normalizedUrl = `https://${useHost}/dp/${asin}`;
    // Dedupe key must NOT include tag — otherwise fixing a tag creates a second inventory row
    // and leaves the old missing-tag row orphaned with zero article associations.
  } else {
    parsed.hash = "";
    if (isAmazon) {
      const keep = new URLSearchParams();
      const tag = parsed.searchParams.get("tag");
      if (tag) keep.set("tag", tag);
      parsed.search = keep.toString() ? `?${keep.toString()}` : "";
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    }
    normalizedUrl = parsed.toString();
  }

  return {
    url: trimmed.startsWith("//") ? absolute : trimmed,
    normalizedUrl,
    network,
    asin,
    affiliateTag,
    tagStatus,
  };
}

export function parseAffiliateHref(
  href: string,
  anchorText: string | null = null,
): ParsedAffiliateLink | null {
  const normalized = normalizeAffiliateUrl(href);
  if (!normalized) return null;
  return {
    ...normalized,
    anchorText: anchorText?.trim() || null,
  };
}

export function extractAffiliateLinksFromHtml(html: string): ParsedAffiliateLink[] {
  const found = new Map<string, ParsedAffiliateLink>();

  for (const match of html.matchAll(HREF_RE)) {
    const href = match[1] ?? "";
    const anchorText = stripTags(match[2] ?? "");
    const parsed = parseAffiliateHref(href, anchorText || null);
    if (!parsed) continue;

    const existing = found.get(parsed.normalizedUrl);
    if (!existing) {
      found.set(parsed.normalizedUrl, parsed);
      continue;
    }
    if (!existing.anchorText && parsed.anchorText) {
      found.set(parsed.normalizedUrl, { ...existing, anchorText: parsed.anchorText });
    }
  }

  // Also catch bare Amazon URLs outside anchors (rare in tables)
  const bareUrlRe =
    /https?:\/\/(?:www\.)?(?:amazon\.[a-z.]+|amzn\.to)\/[^\s"'<>]+|https?:\/\/(?:www\.)?shareasale\.com\/[^\s"'<>]+/gi;
  for (const match of html.matchAll(bareUrlRe)) {
    const parsed = parseAffiliateHref(match[0]);
    if (!parsed) continue;
    if (!found.has(parsed.normalizedUrl)) {
      found.set(parsed.normalizedUrl, parsed);
    }
  }

  return [...found.values()];
}

export function isAffiliateUrl(url: string): boolean {
  return normalizeAffiliateUrl(url) !== null;
}

function isAmznShortHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "amzn.to" || host === "www.amzn.to";
}

export type EnsureAmazonTagResult =
  | { status: "unchanged"; url: string }
  | { status: "rewritten"; url: string; previousTag: string | null }
  | { status: "skipped_short_link"; url: string }
  | { status: "not_amazon"; url: string };

/**
 * Force Amazon Associates tag on a URL. Skips amzn.to short links.
 * Preserves `&amp;` encoding when the input used HTML entities.
 */
export function ensureAmazonAffiliateTag(
  rawUrl: string,
  expectedTag = EXPECTED_AMAZON_AFFILIATE_TAG,
): EnsureAmazonTagResult {
  const usedAmpEntity = /&amp;/i.test(rawUrl);
  const trimmed = decodeHtmlEntities(rawUrl.trim());
  if (!trimmed) {
    return { status: "not_amazon", url: rawUrl };
  }

  let absolute = trimmed;
  if (trimmed.startsWith("//")) {
    absolute = `https:${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(absolute);
  } catch {
    return { status: "not_amazon", url: rawUrl };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { status: "not_amazon", url: rawUrl };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!isAmazonHost(hostname)) {
    return { status: "not_amazon", url: rawUrl };
  }

  if (isAmznShortHost(hostname)) {
    return { status: "skipped_short_link", url: rawUrl };
  }

  const previousTag = parsed.searchParams.get("tag");
  if (previousTag && previousTag.toLowerCase() === expectedTag.toLowerCase()) {
    return { status: "unchanged", url: rawUrl };
  }

  parsed.searchParams.set("tag", expectedTag);
  let next = parsed.toString();
  if (usedAmpEntity) {
    next = next.replace(/&/g, "&amp;");
  }

  // Preserve protocol-relative inputs
  if (trimmed.startsWith("//")) {
    next = next.replace(/^https?:/, "");
  }

  return { status: "rewritten", url: next, previousTag };
}

export type RewriteAmazonTagsResult = {
  html: string;
  changedCount: number;
  skippedShortLinks: number;
};

/**
 * Rewrite Amazon hrefs (and bare Amazon URLs) in HTML to use the expected Associates tag.
 * When `shouldRewrite` is provided, only matching URLs are considered.
 */
export function rewriteAmazonAffiliateTagsInHtml(
  html: string,
  expectedTag = EXPECTED_AMAZON_AFFILIATE_TAG,
  shouldRewrite?: (href: string) => boolean,
): RewriteAmazonTagsResult {
  let changedCount = 0;
  let skippedShortLinks = 0;

  let next = html.replace(HREF_RE, (full, href: string) => {
    if (shouldRewrite && !shouldRewrite(href)) {
      return full;
    }
    const result = ensureAmazonAffiliateTag(href, expectedTag);
    if (result.status === "skipped_short_link") {
      skippedShortLinks += 1;
      return full;
    }
    if (result.status !== "rewritten") {
      return full;
    }
    changedCount += 1;
    const quote = full.includes(`href="${href}"`) ? '"' : "'";
    return full.replace(`href=${quote}${href}${quote}`, `href=${quote}${result.url}${quote}`);
  });

  const bareUrlRe = /https?:\/\/(?:www\.)?amazon\.[a-z.]+\/[^\s"'<>]+/gi;
  next = next.replace(bareUrlRe, (match, offset: number, source: string) => {
    const before = source.slice(Math.max(0, offset - 8), offset).toLowerCase();
    if (before.includes("href=") || before.includes("href =")) {
      return match;
    }
    if (shouldRewrite && !shouldRewrite(match)) {
      return match;
    }
    const result = ensureAmazonAffiliateTag(match, expectedTag);
    if (result.status === "skipped_short_link") {
      skippedShortLinks += 1;
      return match;
    }
    if (result.status !== "rewritten") {
      return match;
    }
    changedCount += 1;
    return result.url;
  });

  return { html: next, changedCount, skippedShortLinks };
}

/** Identity key for matching a tracked Amazon link to hrefs (ASIN preferred, else URL without tag). */
export function amazonLinkMatchKey(input: {
  asin?: string | null;
  normalizedUrl?: string;
  url?: string;
}): string | null {
  if (input.asin?.trim()) {
    return `asin:${input.asin.trim().toUpperCase()}`;
  }
  const raw = input.normalizedUrl || input.url;
  if (!raw) return null;
  const parsed = normalizeAffiliateUrl(raw);
  if (!parsed || parsed.network !== "amazon") return null;
  if (parsed.asin) return `asin:${parsed.asin}`;
  try {
    const url = new URL(parsed.normalizedUrl);
    url.searchParams.delete("tag");
    url.hash = "";
    return `url:${url.toString().replace(/\?$/, "")}`;
  } catch {
    return `url:${parsed.normalizedUrl}`;
  }
}

export function affiliateUrlMatchesAmazonTarget(
  candidateUrl: string,
  target: { asin?: string | null; normalizedUrl: string; url: string },
): boolean {
  const candidateKey = amazonLinkMatchKey({ url: candidateUrl });
  const targetKey = amazonLinkMatchKey(target);
  if (!candidateKey || !targetKey) return false;
  return candidateKey === targetKey;
}
