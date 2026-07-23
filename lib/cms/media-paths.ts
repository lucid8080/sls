export function normalizeMediaPublicPath(path: string): string {
  return path.replace(/\/$/, "").toLowerCase();
}

export function encodeMediaId(id: string): string {
  return encodeURIComponent(id);
}

export function decodeMediaId(id: string): string {
  return decodeURIComponent(id);
}

export function normalizeUploadsUrl(value: string): string {
  return value.replace(/^https?:\/\/[^/]+\/wp-content\/uploads\//i, "/media/");
}

export function normalizeMediaLookupKey(value: string): string {
  const withoutOrigin = value.replace(/^https?:\/\/[^/]+/i, "");
  let decoded = withoutOrigin;
  try {
    decoded = decodeURIComponent(withoutOrigin);
  } catch {
    decoded = withoutOrigin;
  }
  return `/${decoded.replace(/\\/g, "/").replace(/^\/+/, "")}`.toLowerCase();
}
