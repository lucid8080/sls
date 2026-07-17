import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { phpUnserialize, PhpValue } from "./php-serialize.js";
import { ParsedWordPressDump, SqlRecord } from "./types.js";

export const AFFILIATE_TAG = "sls0fa-20";

export const AawpProductSchema = z.object({
  asin: z.string().min(1),
  title: z.string(),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  features: z.array(z.string()),
  currency: z.string().optional(),
  price: z.string().optional(),
  brand: z.string().optional(),
});

export const AawpTableProductSchema = z.object({
  asin: z.string().min(1),
  label: z.string().optional(),
  highlight: z.boolean().optional(),
  product: AawpProductSchema.optional(),
});

export const AawpTableSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  slug: z.string(),
  products: z.array(AawpTableProductSchema),
});

export const TablePressTableSchema = z.object({
  id: z.string().min(1),
  postId: z.string().min(1),
  title: z.string(),
  hasHeader: z.boolean(),
  alternatingRowColors: z.boolean().optional(),
  rows: z.array(z.array(z.string())),
});

export const PrettyLinkSchema = z.object({
  slug: z.string().min(1),
  url: z.string().url(),
  name: z.string().optional(),
  sponsored: z.boolean().optional(),
});

export const ProductDisplayReferenceSchema = z.object({
  postId: z.string(),
  postTitle: z.string(),
  slug: z.string(),
  pathname: z.string(),
  kind: z.enum(["tablepress", "aawp"]),
  tableId: z.string(),
  shortcode: z.string(),
});

export const ProductDisplayBundleSchema = z.object({
  generatedAt: z.string(),
  affiliateTag: z.string(),
  tablepress: z.array(TablePressTableSchema),
  aawpTables: z.array(AawpTableSchema),
  aawpProducts: z.array(AawpProductSchema),
  prettyLinks: z.array(PrettyLinkSchema),
  references: z.array(ProductDisplayReferenceSchema),
  summary: z.object({
    tablepressTables: z.number().int().nonnegative(),
    aawpTables: z.number().int().nonnegative(),
    aawpProducts: z.number().int().nonnegative(),
    prettyLinks: z.number().int().nonnegative(),
    references: z.number().int().nonnegative(),
  }),
});

export type ProductDisplayBundle = z.infer<typeof ProductDisplayBundleSchema>;
export type TablePressTable = z.infer<typeof TablePressTableSchema>;
export type AawpTable = z.infer<typeof AawpTableSchema>;

export const PRODUCT_DISPLAY_EXTRA_TABLES = ["aawp_products", "prli_links"] as const;

const MIGRATION_NOTE_RE =
  /<p><em>Migration note: unsupported shortcode removed for manual review\.<\/em><\/p>/gi;

export function extractProductDisplays(dump: ParsedWordPressDump): ProductDisplayBundle {
  const posts = dump.records.posts;
  const postMeta = groupPostMeta(dump.records.postmeta);
  const options = new Map(
    dump.records.options.map((row) => [getString(row, "option_name"), getString(row, "option_value")]),
  );

  const affiliateTag = extractAffiliateTag(options) || AFFILIATE_TAG;
  const aawpProducts = extractAawpProducts(dump.extraRecords.aawp_products ?? [], affiliateTag);
  const aawpByAsin = new Map(aawpProducts.map((product) => [product.asin, product]));
  const tablepress = extractTablePressTables(posts, postMeta, options);
  const aawpTables = extractAawpTables(posts, postMeta, aawpByAsin);
  const prettyLinks = extractPrettyLinks(dump.extraRecords.prli_links ?? []);
  const references = extractReferences(posts);

  const bundle = {
    generatedAt: new Date().toISOString(),
    affiliateTag,
    tablepress,
    aawpTables,
    aawpProducts,
    prettyLinks,
    references,
    summary: {
      tablepressTables: tablepress.length,
      aawpTables: aawpTables.length,
      aawpProducts: aawpProducts.length,
      prettyLinks: prettyLinks.length,
      references: references.length,
    },
  };

  return ProductDisplayBundleSchema.parse(bundle);
}

export function writeProductDisplays(outputDir: string, projectDataDir: string, bundle: ProductDisplayBundle): void {
  mkdirSync(join(outputDir, "reports"), { recursive: true });
  mkdirSync(projectDataDir, { recursive: true });

  writeJson(join(outputDir, "product-displays.json"), bundle);
  writeJson(join(outputDir, "reports", "product-display-inventory.json"), bundle.references);
  writeJson(join(projectDataDir, "tablepress-tables.json"), bundle.tablepress);
  writeJson(join(projectDataDir, "aawp-tables.json"), bundle.aawpTables);
  writeJson(join(projectDataDir, "aawp-products.json"), bundle.aawpProducts);
  writeJson(join(projectDataDir, "pretty-links.json"), bundle.prettyLinks);
  writeJson(join(projectDataDir, "product-displays.json"), {
    generatedAt: bundle.generatedAt,
    affiliateTag: bundle.affiliateTag,
    summary: bundle.summary,
  });
}

export function productDisplayMarker(kind: "tablepress" | "aawp", tableId: string): string {
  return `<figure data-product-display="${kind}" data-id="${escapeAttribute(tableId)}" class="product-display-marker"></figure>`;
}

export function expandProductDisplayShortcodes(
  html: string,
  context: { postId: string; postTitle: string; originalPath: string },
  reports: {
    unknownShortcodes: Array<{
      postId: string;
      postTitle: string;
      originalPath: string;
      reason: string;
      shortcode?: string;
      preview: string;
      severity: "low" | "medium" | "high";
      manualReview: boolean;
    }>;
  },
  knownTablePressIds: Set<string>,
  knownAawpIds: Set<string>,
): string {
  const tableRe = /\[table\b([^\]]*)\]/gi;
  const amazonRe = /\[amazon\b([^\]]*)\]/gi;

  let output = html.replace(tableRe, (shortcode, attrs: string) => {
    const tableId = matchAttr(attrs, "id");
    if (!tableId) {
      reports.unknownShortcodes.push({
        postId: context.postId,
        postTitle: context.postTitle,
        originalPath: context.originalPath,
        reason: "TablePress shortcode missing id.",
        shortcode: shortcode.replace(/\s+/g, " ").slice(0, 80),
        preview: escapeText(shortcode.replace(/\s+/g, " ").slice(0, 180)),
        severity: "medium",
        manualReview: true,
      });
      return '<p><em>Migration note: unsupported shortcode removed for manual review.</em></p>';
    }

    if (!knownTablePressIds.has(tableId)) {
      reports.unknownShortcodes.push({
        postId: context.postId,
        postTitle: context.postTitle,
        originalPath: context.originalPath,
        reason: `TablePress table id '${tableId}' was not found in recovered data.`,
        shortcode: shortcode.replace(/\s+/g, " ").slice(0, 80),
        preview: escapeText(shortcode.replace(/\s+/g, " ").slice(0, 180)),
        severity: "medium",
        manualReview: true,
      });
      return '<p><em>Migration note: unsupported shortcode removed for manual review.</em></p>';
    }

    return productDisplayMarker("tablepress", tableId);
  });

  output = output.replace(amazonRe, (shortcode, attrs: string) => {
    const tableId = matchAttr(attrs, "table");
    if (!tableId) {
      reports.unknownShortcodes.push({
        postId: context.postId,
        postTitle: context.postTitle,
        originalPath: context.originalPath,
        reason: "Amazon shortcode without table attribute left for manual review.",
        shortcode: shortcode.replace(/\s+/g, " ").slice(0, 80),
        preview: escapeText(shortcode.replace(/\s+/g, " ").slice(0, 180)),
        severity: "medium",
        manualReview: true,
      });
      return '<p><em>Migration note: unsupported shortcode removed for manual review.</em></p>';
    }

    if (!knownAawpIds.has(tableId)) {
      reports.unknownShortcodes.push({
        postId: context.postId,
        postTitle: context.postTitle,
        originalPath: context.originalPath,
        reason: `AAWP table id '${tableId}' was not found in recovered data.`,
        shortcode: shortcode.replace(/\s+/g, " ").slice(0, 80),
        preview: escapeText(shortcode.replace(/\s+/g, " ").slice(0, 180)),
        severity: "medium",
        manualReview: true,
      });
      return '<p><em>Migration note: unsupported shortcode removed for manual review.</em></p>';
    }

    return productDisplayMarker("aawp", tableId);
  });

  return output;
}

export type ShortcodeInventoryEntry = {
  postId: string;
  shortcode: string;
  kind?: "tablepress" | "aawp" | "other";
  tableId?: string;
};

/**
 * Replace migration-note placeholders in already-formatted HTML using the
 * ordered unknown-shortcode inventory. Non-product shortcodes keep their notes.
 */
export function reinjectProductDisplayMarkers(
  html: string,
  entries: ShortcodeInventoryEntry[],
): { html: string; reinjected: number } {
  if (entries.length === 0) {
    return { html, reinjected: 0 };
  }

  let index = 0;
  let reinjected = 0;
  const nextHtml = html.replace(MIGRATION_NOTE_RE, (match) => {
    const entry = entries[index];
    index += 1;
    if (!entry || (entry.kind !== "tablepress" && entry.kind !== "aawp") || !entry.tableId) {
      return match;
    }
    reinjected += 1;
    return productDisplayMarker(entry.kind, entry.tableId);
  });

  return { html: nextHtml, reinjected };
}

export function classifyShortcode(shortcode: string): ShortcodeInventoryEntry["kind"] {
  const tableMatch = shortcode.match(/^\[table\b/i);
  if (tableMatch) {
    return "tablepress";
  }
  if (/^\[amazon\b/i.test(shortcode) && /\btable\s*=/i.test(shortcode)) {
    return "aawp";
  }
  return "other";
}

export function parseShortcodeTableId(shortcode: string, kind: "tablepress" | "aawp"): string | undefined {
  if (kind === "tablepress") {
    return matchAttr(shortcode.replace(/^\[table\b/i, ""), "id") ?? matchAttr(shortcode, "id");
  }
  return matchAttr(shortcode.replace(/^\[amazon\b/i, ""), "table") ?? matchAttr(shortcode, "table");
}

function extractAffiliateTag(options: Map<string, string>): string | undefined {
  const referTag = options.get("refer_amazon_affiliate_id");
  if (referTag && /^[a-z0-9-]+$/i.test(referTag)) {
    return referTag;
  }
  return undefined;
}

function extractAawpProducts(rows: SqlRecord[], affiliateTag: string) {
  const products = [];

  for (const row of rows) {
    const asin = getString(row, "asin");
    if (!asin) {
      continue;
    }

    const title = getString(row, "title");
    const features = parseFeatureList(getString(row, "features"));
    const imageIds = getString(row, "image_ids")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const imageUrl = imageIds[0] ? amazonImageUrl(imageIds[0]) : undefined;
    const brand = parseBrand(getString(row, "attributes"));

    products.push(
      AawpProductSchema.parse({
        asin,
        title,
        url: amazonProductUrl(asin, affiliateTag),
        imageUrl,
        features,
        currency: optional(getString(row, "currency")),
        price: formatPrice(getString(row, "price"), getString(row, "currency")),
        brand,
      }),
    );
  }

  return products;
}

function extractTablePressTables(
  posts: SqlRecord[],
  postMeta: Map<string, Map<string, string>>,
  options: Map<string, string>,
) {
  const mapping = parseTablePressMapping(options.get("tablepress_tables") ?? "");
  const tables = [];

  for (const [tableId, postId] of mapping) {
    const post = posts.find((row) => getString(row, "ID") === postId && getString(row, "post_type") === "tablepress_table");
    if (!post) {
      continue;
    }

    const rawData = getString(post, "post_content");
    let rows: string[][] = [];
    try {
      const parsed = JSON.parse(rawData) as unknown;
      if (Array.isArray(parsed)) {
        rows = parsed.map((row) =>
          Array.isArray(row)
            ? row.map((cell) => normalizeNbspInCell(String(cell ?? "")))
            : [normalizeNbspInCell(String(row ?? ""))],
        );
      }
    } catch {
      continue;
    }

    const optionsRaw = postMeta.get(postId)?.get("_tablepress_table_options");
    let hasHeader = true;
    let alternatingRowColors = true;
    if (optionsRaw) {
      try {
        const parsed = JSON.parse(optionsRaw) as { table_head?: boolean; alternating_row_colors?: boolean };
        hasHeader = parsed.table_head !== false;
        alternatingRowColors = parsed.alternating_row_colors !== false;
      } catch {
        // keep defaults
      }
    }

    const visibilityRaw = postMeta.get(postId)?.get("_tablepress_table_visibility");
    if (visibilityRaw) {
      try {
        const visibility = JSON.parse(visibilityRaw) as { rows?: number[]; columns?: number[] };
        rows = applyVisibility(rows, visibility.rows, visibility.columns);
      } catch {
        // keep full table
      }
    }

    tables.push(
      TablePressTableSchema.parse({
        id: tableId,
        postId,
        title: getString(post, "post_title") || `Table ${tableId}`,
        hasHeader,
        alternatingRowColors,
        rows,
      }),
    );
  }

  return tables;
}

function extractAawpTables(
  posts: SqlRecord[],
  postMeta: Map<string, Map<string, string>>,
  productsByAsin: Map<string, z.infer<typeof AawpProductSchema>>,
) {
  const tables = [];

  for (const post of posts) {
    if (getString(post, "post_type") !== "aawp_table") {
      continue;
    }

    const id = getString(post, "ID");
    const meta = postMeta.get(id);
    const productsRaw = meta?.get("_aawp_table_products");
    if (!productsRaw) {
      continue;
    }

    let parsed: PhpValue;
    try {
      parsed = phpUnserialize(productsRaw);
    } catch {
      continue;
    }

    const productEntries = Array.isArray(parsed) ? parsed : Object.values(parsed as object);
    const products = [];

    for (const entry of productEntries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }
      const record = entry as Record<string, PhpValue>;
      if (record.status === false) {
        continue;
      }
      const asin = String(record.asin ?? "");
      if (!asin) {
        continue;
      }

      const label = extractAawpLabel(record.rows);
      products.push({
        asin,
        label: label || undefined,
        highlight: Boolean(record.highlight),
        product: productsByAsin.get(asin),
      });
    }

    tables.push(
      AawpTableSchema.parse({
        id,
        title: getString(post, "post_title") || `AAWP Table ${id}`,
        slug: getString(post, "post_name") || id,
        products,
      }),
    );
  }

  return tables;
}

function extractPrettyLinks(rows: SqlRecord[]) {
  const links = [];

  for (const row of rows) {
    const slug = getString(row, "slug");
    const url = getString(row, "url");
    if (!slug || !url || getString(row, "link_status") === "disabled") {
      continue;
    }

    try {
      links.push(
        PrettyLinkSchema.parse({
          slug,
          url,
          name: optional(getString(row, "name")),
          sponsored: getString(row, "sponsored") === "1",
        }),
      );
    } catch {
      // skip invalid URLs
    }
  }

  return links;
}

function extractReferences(posts: SqlRecord[]) {
  const references = [];

  for (const post of posts) {
    if (getString(post, "post_type") !== "post" && getString(post, "post_type") !== "page") {
      continue;
    }
    if (getString(post, "post_status") !== "publish") {
      continue;
    }

    const content = getString(post, "post_content");
    const postId = getString(post, "ID");
    const postTitle = getString(post, "post_title");
    const slug = getString(post, "post_name");
    const pathname = `/${slug}/`;

    for (const match of content.matchAll(/\[table\b([^\]]*)\]/gi)) {
      const tableId = matchAttr(match[1] ?? "", "id");
      if (!tableId) {
        continue;
      }
      references.push({
        postId,
        postTitle,
        slug,
        pathname,
        kind: "tablepress" as const,
        tableId,
        shortcode: match[0].replace(/\s+/g, " ").slice(0, 120),
      });
    }

    for (const match of content.matchAll(/\[amazon\b([^\]]*)\]/gi)) {
      const tableId = matchAttr(match[1] ?? "", "table");
      if (!tableId) {
        continue;
      }
      references.push({
        postId,
        postTitle,
        slug,
        pathname,
        kind: "aawp" as const,
        tableId,
        shortcode: match[0].replace(/\s+/g, " ").slice(0, 120),
      });
    }
  }

  return references;
}

function parseTablePressMapping(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) {
    return map;
  }

  try {
    const parsed = JSON.parse(raw) as { table_post?: Record<string, number | string> };
    for (const [tableId, postId] of Object.entries(parsed.table_post ?? {})) {
      map.set(String(tableId), String(postId));
    }
  } catch {
    // ignore
  }

  return map;
}

function applyVisibility(rows: string[][], rowVisibility?: number[], columnVisibility?: number[]): string[][] {
  let next = rows;
  if (Array.isArray(rowVisibility) && rowVisibility.length === rows.length) {
    next = next.filter((_, index) => rowVisibility[index] !== 0);
  }
  if (Array.isArray(columnVisibility) && next[0] && columnVisibility.length === next[0].length) {
    next = next.map((row) => row.filter((_, index) => columnVisibility[index] !== 0));
  }
  return next;
}

function extractAawpLabel(rows: PhpValue): string {
  if (!Array.isArray(rows) && (!rows || typeof rows !== "object")) {
    return "";
  }

  const list = Array.isArray(rows) ? rows : Object.values(rows as object);
  for (const row of list) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    const values = (row as Record<string, PhpValue>).values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      continue;
    }
    const custom = (values as Record<string, PhpValue>).custom_text;
    if (typeof custom === "string" && custom.trim()) {
      return custom.replace(/^\[|\]$/g, "").trim();
    }
  }

  return "";
}

function parseFeatureList(raw: string): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = phpUnserialize(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed)
        .map((item) => String(item))
        .filter(Boolean);
    }
  } catch {
    // ignore
  }

  return [];
}

function parseBrand(raw: string): string | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = phpUnserialize(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const basic = (parsed as Record<string, PhpValue>).basic_info;
    if (!basic || typeof basic !== "object" || Array.isArray(basic)) {
      return undefined;
    }
    const brand = (basic as Record<string, PhpValue>).brand;
    return typeof brand === "string" && brand ? brand : undefined;
  } catch {
    return undefined;
  }
}

function amazonProductUrl(asin: string, tag: string): string {
  return `https://www.amazon.com/dp/${encodeURIComponent(asin)}?tag=${encodeURIComponent(tag)}`;
}

function amazonImageUrl(imageId: string): string {
  // Keep Amazon image ids intact; encoding "+" breaks some CDN paths.
  const safeId = imageId.replace(/[^A-Za-z0-9_+.-]/g, "");
  return `https://m.media-amazon.com/images/I/${safeId}._AC_SL320_.jpg`;
}

function formatPrice(price: string, currency: string): string | undefined {
  if (!price) {
    return undefined;
  }

  const numeric = Number(price);
  if (!Number.isFinite(numeric)) {
    return price;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency && /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD",
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `$${numeric}`;
  }
}

function matchAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']?([^\\s"'\\]/]+)`, "i"));
  return match?.[1];
}

function groupPostMeta(rows: SqlRecord[]): Map<string, Map<string, string>> {
  const grouped = new Map<string, Map<string, string>>();

  for (const row of rows) {
    const postId = getString(row, "post_id");
    const key = getString(row, "meta_key");
    const value = getString(row, "meta_value");
    if (!postId || !key) {
      continue;
    }
    if (!grouped.has(postId)) {
      grouped.set(postId, new Map());
    }
    grouped.get(postId)?.set(key, value);
  }

  return grouped;
}

function getString(record: SqlRecord, key: string): string {
  return record[key] ?? "";
}

function optional(value: string): string | undefined {
  return value ? value : undefined;
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeNbspInCell(value: string): string {
  return value
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/\u00a0/g, " ");
}
