import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { z } from "zod";

const aawpProductSchema = z.object({
  asin: z.string(),
  title: z.string(),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  features: z.array(z.string()),
  currency: z.string().optional(),
  price: z.string().optional(),
  brand: z.string().optional(),
});

const aawpTableSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  products: z.array(
    z.object({
      asin: z.string(),
      label: z.string().optional(),
      highlight: z.boolean().optional(),
      product: aawpProductSchema.optional(),
    }),
  ),
});

const tablePressSchema = z.object({
  id: z.string(),
  postId: z.string(),
  title: z.string(),
  hasHeader: z.boolean(),
  alternatingRowColors: z.boolean().optional(),
  rows: z.array(z.array(z.string())),
});

export type AawpTable = z.infer<typeof aawpTableSchema>;
export type TablePressTable = z.infer<typeof tablePressSchema>;

export const getAawpTables = cache(() => {
  const path = join(process.cwd(), "data", "aawp-tables.json");
  return z.array(aawpTableSchema).parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
});

export const getTablePressTables = cache(() => {
  const path = join(process.cwd(), "data", "tablepress-tables.json");
  return z.array(tablePressSchema).parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
});

export function getAawpTable(id: string): AawpTable | undefined {
  return getAawpTables().find((table) => table.id === id);
}

export function getTablePressTable(id: string): TablePressTable | undefined {
  return getTablePressTables().find((table) => table.id === id);
}

const MARKER_RE =
  /<figure\b[^>]*\bdata-product-display="(tablepress|aawp)"[^>]*\bdata-id="([^"]+)"[^>]*><\/figure>/gi;

export type ArticleSegment =
  | { type: "html"; html: string }
  | { type: "tablepress"; id: string }
  | { type: "aawp"; id: string };

export function splitProductDisplaySegments(html: string): ArticleSegment[] {
  const segments: ArticleSegment[] = [];
  let lastIndex = 0;

  for (const match of html.matchAll(MARKER_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "html", html: html.slice(lastIndex, index) });
    }
    const kind = match[1] as "tablepress" | "aawp";
    const id = match[2];
    segments.push({ type: kind, id });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: "html", html: html.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "html", html }];
}
