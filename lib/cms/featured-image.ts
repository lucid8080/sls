import { FeaturedImageSchema, type FeaturedImage } from "@/lib/cms/schemas";

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

/** Convert absolute site/media URLs to public `/media/...` paths. */
export function toPublicMediaPath(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("/")) {
    return trimmed.split(/[?#]/)[0] || undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.pathname.startsWith("/wp-content/uploads/")) {
      return `/media/${url.pathname.slice("/wp-content/uploads/".length)}`.replace(/\/{2,}/g, "/");
    }
    if (url.pathname.startsWith("/media/")) {
      return url.pathname;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizeVariant(value: unknown): { src: string; width: number; height: number } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.src !== "string") {
    return undefined;
  }

  const src = toPublicMediaPath(raw.src);
  if (!src) {
    return undefined;
  }

  return {
    src,
    width: typeof raw.width === "number" && raw.width > 0 ? raw.width : DEFAULT_WIDTH,
    height: typeof raw.height === "number" && raw.height > 0 ? raw.height : DEFAULT_HEIGHT,
  };
}

/**
 * Coerce DB/API featuredImage values (including bare URL strings) into the
 * export schema shape. Returns undefined when the value cannot be salvaged.
 */
export function normalizeFeaturedImage(value: unknown): FeaturedImage | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    const src = toPublicMediaPath(value);
    if (!src) {
      return undefined;
    }
    return {
      src,
      alt: "",
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.src !== "string") {
    return undefined;
  }

  const src = toPublicMediaPath(raw.src);
  if (!src) {
    return undefined;
  }

  const variantsRaw =
    raw.variants && typeof raw.variants === "object" && !Array.isArray(raw.variants)
      ? (raw.variants as Record<string, unknown>)
      : undefined;

  const variants = variantsRaw
    ? {
        thumbnail: normalizeVariant(variantsRaw.thumbnail),
        card: normalizeVariant(variantsRaw.card),
        large: normalizeVariant(variantsRaw.large),
      }
    : undefined;

  const hasVariant = Boolean(variants?.thumbnail || variants?.card || variants?.large);

  const candidate = {
    src,
    alt: typeof raw.alt === "string" ? raw.alt : "",
    caption: typeof raw.caption === "string" ? raw.caption : undefined,
    width: typeof raw.width === "number" && raw.width > 0 ? raw.width : DEFAULT_WIDTH,
    height: typeof raw.height === "number" && raw.height > 0 ? raw.height : DEFAULT_HEIGHT,
    variants: hasVariant ? variants : undefined,
  };

  const parsed = FeaturedImageSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

export type MediaAssetLike = {
  publicPath: string;
  alt?: string | null;
  width?: string | number | null;
  height?: string | number | null;
};

function parseDimension(value: string | number | null | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }
  return fallback;
}

/** Build a FeaturedImage from a media library / upload API asset. */
export function featuredImageFromMediaAsset(asset: MediaAssetLike): FeaturedImage | undefined {
  const src = toPublicMediaPath(asset.publicPath);
  if (!src) {
    return undefined;
  }

  const candidate = {
    src,
    alt: typeof asset.alt === "string" ? asset.alt : "",
    width: parseDimension(asset.width, DEFAULT_WIDTH),
    height: parseDimension(asset.height, DEFAULT_HEIGHT),
  };

  const parsed = FeaturedImageSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}
