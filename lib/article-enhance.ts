import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { z } from "zod";

const aawpProductSchema = z.object({
  asin: z.string(),
  title: z.string(),
  imageUrl: z.string().url().optional(),
});

const mediaAcceptedSchema = z.array(
  z.object({
    originalPath: z.string(),
    outputPath: z.string().optional(),
  }),
);

type ProductImageCandidate = {
  src: string;
  scoreTokens: string[];
  priority: number;
};

const getProductImageCandidates = cache((): ProductImageCandidate[] => {
  const candidates: ProductImageCandidate[] = [];

  try {
    const aawpPath = join(process.cwd(), "data", "aawp-products.json");
    const products = z.array(aawpProductSchema).parse(JSON.parse(readFileSync(aawpPath, "utf8")) as unknown);
    for (const product of products) {
      if (!product.imageUrl) {
        continue;
      }
      candidates.push({
        src: product.imageUrl,
        scoreTokens: tokenize(product.title),
        priority: 20,
      });
    }
  } catch {
    // AAWP catalog is optional for enhancement.
  }

  try {
    const reportPath = join(process.cwd(), "recovered-media-output", "reports", "media-accepted.json");
    const media = mediaAcceptedSchema.parse(JSON.parse(readFileSync(reportPath, "utf8")) as unknown);
    for (const item of media) {
      if (!item.outputPath) {
        continue;
      }
      const basename = item.originalPath.split(/[/\\]/).pop() ?? "";
      if (!isLikelyProductMedia(basename)) {
        continue;
      }
      candidates.push({
        src: `/${normalizeSlashes(item.outputPath)}`,
        scoreTokens: tokenize(basename.replace(/\.[^.]+$/, "")),
        priority: mediaPriority(basename),
      });
    }
  } catch {
    // Media report is optional for enhancement.
  }

  return candidates;
});

/** Wrap plain article tables so they keep table layout and scroll on small screens. */
export function wrapArticleTables(html: string): string {
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table) => {
    if (/class=["'][^"']*(?:product-comparison__table|spec-chart__table|article-table)/i.test(table)) {
      return table;
    }
    if (/class=["'][^"']*article-table-scroll/i.test(table)) {
      return table;
    }

    const withClass = /class=["']([^"']*)["']/i.test(table)
      ? table.replace(/class=["']([^"']*)["']/i, (_m, existing: string) => `class="${existing} article-table"`)
      : table.replace(/<table\b/i, '<table class="article-table"');

    return `<div class="article-table-scroll">${withClass}</div>`;
  });
}

/**
 * Turn numbered / award-style product review blocks that include an Amazon CTA
 * into visual product-pick cards (optional image from AAWP or recovered media).
 */
export function enhanceProductPicks(html: string): string {
  if (!/(amazon\.com|amzn\.to)/i.test(html)) {
    return html;
  }

  const headingRe = /<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const headings: Array<{
    level: 2 | 3;
    start: number;
    end: number;
    openTag: string;
    innerHtml: string;
    text: string;
  }> = [];

  for (const match of html.matchAll(headingRe)) {
    const full = match[0];
    const level = Number(match[1]![1]) as 2 | 3;
    const start = match.index ?? 0;
    headings.push({
      level,
      start,
      end: start + full.length,
      openTag: `<${match[1]}${match[2]}>`,
      innerHtml: match[3] ?? "",
      text: stripTags(match[3] ?? ""),
    });
  }

  if (headings.length === 0) {
    return html;
  }

  const pieces: string[] = [];
  let cursor = 0;

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!;
    const nextSameOrHigher = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    const bodyEnd = nextSameOrHigher?.start ?? html.length;
    const body = html.slice(heading.end, bodyEnd);

    if (heading.start > cursor) {
      pieces.push(html.slice(cursor, heading.start));
    }

    const alreadyCard = /class=["'][^"']*product-pick/i.test(heading.openTag) || /class=["'][^"']*product-pick/i.test(body);
    const isPick = !alreadyCard && isProductPickHeading(heading.text) && hasAmazonCta(body);

    if (!isPick) {
      pieces.push(html.slice(heading.start, bodyEnd));
      cursor = bodyEnd;
      continue;
    }

    const parsed = parsePickTitle(heading.text);
    const image = findProductImage(parsed.productName);
    const headingTag = `h${heading.level}`;
    const media = image
      ? `<div class="product-pick__media"><img class="product-pick__image" src="${escapeAttribute(image.src)}" alt="" loading="lazy" decoding="async" width="240" height="240" /></div>`
      : `<div class="product-pick__media product-pick__media--placeholder" aria-hidden="true"><span class="product-pick__monogram">${escapeHtml(parsed.monogram)}</span></div>`;

    const badge = parsed.badge
      ? `<p class="product-pick__badge">${escapeHtml(parsed.badge)}</p>`
      : "";

    pieces.push(
      `<article class="product-pick">` +
        media +
        `<div class="product-pick__content">` +
        badge +
        `<${headingTag} class="product-pick__title">${escapeHtml(parsed.productName)}</${headingTag}>` +
        body +
        `</div></article>`,
    );
    cursor = bodyEnd;
  }

  if (cursor < html.length) {
    pieces.push(html.slice(cursor));
  }

  return pieces.join("");
}

export function enhanceArticleHtml(html: string): string {
  return wrapArticleTables(enhanceProductPicks(html));
}

export function isProductPickHeading(text: string): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 8 || cleaned.length > 160) {
    return false;
  }

  if (/^#?\d+[.)]\s+\S/.test(cleaned)) {
    return true;
  }

  if (/^(best|top|editor'?s?\s+choice|budget|premium|overall)\b/i.test(cleaned) && /[:—–-]/.test(cleaned)) {
    return true;
  }

  if (/^.+\s[—–-]\s+(best|top|great|ideal|budget|premium)\b/i.test(cleaned)) {
    return true;
  }

  return false;
}

export function parsePickTitle(text: string): { productName: string; badge?: string; monogram: string } {
  const cleaned = text.replace(/\s+/g, " ").trim();

  const working = cleaned.replace(/^#?\d+[.)]\s+/, "");

  const emDash = working.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (emDash) {
    return {
      productName: emDash[1]!.trim(),
      badge: emDash[2]!.trim(),
      monogram: monogramFrom(emDash[1]!),
    };
  }

  const labeled = working.match(/^(best\s+[^:]+|editor'?s?\s+choice|budget[^:]*|premium[^:]*)\s*:\s*(.+)$/i);
  if (labeled) {
    return {
      productName: labeled[2]!.trim(),
      badge: labeled[1]!.trim(),
      monogram: monogramFrom(labeled[2]!),
    };
  }

  const paren = working.match(/^(.+?)\s+\(([^)]+)\)\s*$/);
  if (paren && /best|powerful|overall|value|budget/i.test(paren[2]!)) {
    return {
      productName: paren[1]!.trim(),
      badge: paren[2]!.trim(),
      monogram: monogramFrom(paren[1]!),
    };
  }

  return {
    productName: working,
    monogram: monogramFrom(working),
  };
}

export function findProductImage(productName: string): { src: string } | undefined {
  const queryTokens = tokenize(productName);
  if (queryTokens.length === 0) {
    return undefined;
  }

  const modelTokens = queryTokens.filter((token) => /\d/.test(token));
  let best: { src: string; score: number } | undefined;

  for (const candidate of getProductImageCandidates()) {
    const overlapTokens = queryTokens.filter((token) => candidate.scoreTokens.includes(token));
    if (overlapTokens.length === 0) {
      continue;
    }

    let score = overlapTokens.length * 10 + candidate.priority;
    if (modelTokens.length > 0) {
      const modelHits = modelTokens.filter((token) => candidate.scoreTokens.includes(token)).length;
      if (modelHits === 0) {
        score -= 40;
      } else {
        score += modelHits * 15;
      }
    }

    if (!best || score > best.score) {
      best = { src: candidate.src, score };
    }
  }

  // Brand + another token (or branded AAWP hit) required.
  if (!best || best.score < 22) {
    return undefined;
  }

  return { src: best.src };
}

function hasAmazonCta(html: string): boolean {
  return /href=["'][^"']*(?:amazon\.com|amzn\.to)/i.test(html);
}

function isLikelyProductMedia(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (/(recipe|soup|stew|logo|unsplash|screenshot|chart|table|infographic)/i.test(lower)) {
    return false;
  }
  return /(roborock|roomba|ecovacs|deebot|shark|eufy|dreame|makita|irobot|vacuum|instant|microwave|air-?fryer|hub|echo|nest)/i.test(
    lower,
  );
}

function mediaPriority(filename: string): number {
  if (/-\d{2,4}x\d{2,4}\./i.test(filename)) {
    const match = filename.match(/-(\d{2,4})x(\d{2,4})\./i);
    if (match) {
      const width = Number(match[1]);
      if (width <= 150) {
        return 1;
      }
      if (width <= 300) {
        return 4;
      }
      return 8;
    }
  }
  return 12;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_TOKENS.has(token));
}

function monogramFrom(value: string): string {
  const words = value
    .replace(/^#?\d+[.)]\s+/, "")
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? "P";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/gi, " ").trim();
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

const STOP_TOKENS = new Set([
  "the",
  "and",
  "for",
  "with",
  "best",
  "overall",
  "option",
  "robot",
  "vacuum",
  "mop",
  "combo",
  "ultra",
  "pro",
  "max",
  "gen",
  "in",
  "of",
  "to",
  "a",
  "an",
]);
