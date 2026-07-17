import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { z } from "zod";

const mediaAcceptedSchema = z.array(
  z.object({
    originalPath: z.string(),
    outputPath: z.string().optional(),
    mediaType: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
);

const YOUTUBE_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[^\s<"]*)?/i;

export type MediaReference = {
  originalPath: string;
  publicPath: string;
  width?: number;
  height?: number;
};

function resolveMediaAcceptedPath(): string | null {
  const candidates = [
    join(process.cwd(), "data", "media-accepted.json"),
    join(process.cwd(), "recovered-media-output", "reports", "media-accepted.json"),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

export const getMediaMap = cache(() => {
  const map = new Map<string, MediaReference>();
  const reportPath = resolveMediaAcceptedPath();
  if (!reportPath) {
    return map;
  }

  const parsed = mediaAcceptedSchema.parse(JSON.parse(readFileSync(reportPath, "utf8")) as unknown);

  for (const item of parsed) {
    if (!item.outputPath) {
      continue;
    }

    const publicPath = `/${normalizeSlashes(item.outputPath)}`;
    const originalPath = `/media/${normalizeSlashes(item.originalPath)}`;
    map.set(normalizeMediaKey(originalPath), {
      originalPath,
      publicPath,
      width: item.width,
      height: item.height,
    });
  }

  return map;
});

export function rewriteMediaAndEmbeds(html: string): string {
  return rewriteYouTubeFigures(rewriteImageSources(html));
}

export function rewriteImageSources(html: string): string {
  const mediaMap = getMediaMap();

  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (full, before: string, src: string, after: string) => {
    const normalizedSrc = normalizeUploadsUrl(src);
    const media = mediaMap.get(normalizeMediaKey(normalizedSrc)) ?? mediaMap.get(normalizeMediaKey(src));
    if (!media) {
      return full;
    }

    const attrs = `${before}src="${escapeAttribute(media.publicPath)}"${after}`;
    return ensureImageAttributes(`<img${attrs}>`, media);
  });
}

function normalizeUploadsUrl(value: string): string {
  return value.replace(/^https?:\/\/[^/]+\/wp-content\/uploads\//i, "/media/");
}

export function rewriteYouTubeFigures(html: string): string {
  return html.replace(/<figure>\s*(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^<\s]+)\s*<\/figure>/gi, (full, url: string) => {
    const videoId = parseYouTubeId(url);
    if (!videoId) {
      return full;
    }

    const title = "YouTube video player";
    return `<figure class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>`;
  });
}

export function parseYouTubeId(value: string): string | undefined {
  const match = value.match(YOUTUBE_URL_RE);
  return match?.[1];
}

function ensureImageAttributes(img: string, media: MediaReference): string {
  let output = img;

  if (!/\bloading=/.test(output)) {
    output = output.replace(/>$/, ' loading="lazy">');
  }

  if (!/\bdecoding=/.test(output)) {
    output = output.replace(/>$/, ' decoding="async">');
  }

  if (media.width && !/\bwidth=/.test(output)) {
    output = output.replace(/>$/, ` width="${media.width}">`);
  }

  if (media.height && !/\bheight=/.test(output)) {
    output = output.replace(/>$/, ` height="${media.height}">`);
  }

  return output;
}

function normalizeMediaKey(value: string): string {
  const withoutOrigin = value.replace(/^https?:\/\/[^/]+/i, "");
  let decoded = withoutOrigin;
  try {
    decoded = decodeURIComponent(withoutOrigin);
  } catch {
    decoded = withoutOrigin;
  }
  return `/${normalizeSlashes(decoded).replace(/^\/+/, "")}`.toLowerCase();
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
