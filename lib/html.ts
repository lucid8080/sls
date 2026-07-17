/** Convert NBSP entities/characters to regular spaces for readable article HTML. */
export function normalizeNbspEntities(value: string): string {
  return value
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/\u00a0/g, " ");
}

/**
 * Collapse double-encoded ampersands (`&amp;amp;` → `&amp;`) so "A & B"
 * does not render as the literal text "A &amp; B".
 */
export function normalizeDoubleEncodedAmps(value: string): string {
  let result = value;
  // WordPress / recovery pipelines sometimes encode `&` more than once.
  while (/&amp;amp;/i.test(result)) {
    result = result.replace(/&amp;amp;/gi, "&amp;");
  }
  return result;
}

/** Normalize recovered article HTML entities before render. */
export function normalizeArticleHtmlEntities(value: string): string {
  return normalizeDoubleEncodedAmps(normalizeNbspEntities(value));
}
