export const SOURCE_PLATFORMS = [
  "generic_web",
  "youtube",
  "x",
  "twitter",
  "instagram",
  "tiktok",
  "reddit",
  "linkedin",
  "facebook",
  "threads",
  "unknown",
] as const;

export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

export type ResolvedPublicAddress = {
  address: string;
  family: 4 | 6;
};

export type SafeFetchResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  redirectCount: number;
};

export type ExtractedSourceMetadata = {
  finalUrl: string;
  canonicalUrl?: string;
  pageTitle?: string;
  pageDescription?: string;
  authorName?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  extractedText?: string;
  rawMetadata: Record<string, string>;
};
