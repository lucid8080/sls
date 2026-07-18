const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  nbsp: " ",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

export function decodeBasicHtmlEntities(input: string): string {
  return input.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z][a-z0-9]{1,15}));/gi,
    (entity, decimal: string, hex: string, named: string) => {
      if (named) return ENTITY_MAP[named.toLowerCase()] ?? entity;
      const codePoint = Number.parseInt(decimal || hex, decimal ? 10 : 16);
      if (!Number.isFinite(codePoint) || codePoint < 1 || codePoint > 0x10ffff) {
        return "";
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return "";
      }
    },
  );
}

export function extractReadableText(html: string, maxChars = 50_000): string {
  const preferred =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;

  const text = preferred
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|template|svg|canvas|form|nav|footer|aside)\b[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section)>/gi, "\n")
    .replace(/<[^>]{0,1000}>/g, " ");

  return decodeBasicHtmlEntities(text)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}
