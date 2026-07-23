import { recoveredArticleToAdminArticle, listAdminArticles, type AdminArticle } from "@/lib/cms/admin-articles";
import { getRecoveredContentBundle } from "@/lib/content";
import {
  normalizeMediaLookupKey,
  normalizeMediaPublicPath,
  normalizeUploadsUrl,
} from "@/lib/cms/media-paths";
import { getMediaMap, getRecoveredMediaCatalog } from "@/lib/media";

export type MediaUsageRole = "featured" | "og" | "inline";

export type MediaUsageEntry = {
  articleId: string;
  title: string;
  pathname: string;
  source: "database" | "recovered";
  roles: MediaUsageRole[];
};

type FeaturedImageLike = {
  src?: string;
  variants?: {
    thumbnail?: { src?: string };
    card?: { src?: string };
    large?: { src?: string };
  };
};

const USAGE_INDEX_CACHE_MS = 60_000;

let cachedUsageIndex: Map<string, MediaUsageEntry[]> | null = null;
let cachedUsageIndexAt = 0;
let inFlightUsageIndex: Promise<Map<string, MediaUsageEntry[]>> | null = null;
let cachedCatalogPaths: Set<string> | null = null;

function getCatalogPathSet(): Set<string> {
  if (!cachedCatalogPaths) {
    cachedCatalogPaths = new Set(
      getRecoveredMediaCatalog().map((item) => normalizeMediaPublicPath(item.publicPath)),
    );
  }
  return cachedCatalogPaths;
}

function collectArticlePaths(article: AdminArticle): Array<{ path: string; role: MediaUsageRole }> {
  const paths: Array<{ path: string; role: MediaUsageRole }> = [];
  const featured = article.featuredImage as FeaturedImageLike | null | undefined;

  if (featured?.src) {
    paths.push({ path: featured.src, role: "featured" });
  }
  for (const variant of [featured?.variants?.thumbnail, featured?.variants?.card, featured?.variants?.large]) {
    if (variant?.src) {
      paths.push({ path: variant.src, role: "featured" });
    }
  }

  if (article.seo.ogImage) {
    paths.push({ path: article.seo.ogImage, role: "og" });
  }

  const html = article.html ?? "";
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) {
    paths.push({ path: match[1], role: "inline" });
  }

  return paths;
}

function resolveToPublicPath(
  rawPath: string,
  mediaMap: ReturnType<typeof getMediaMap>,
  catalogPaths: Set<string>,
): string | null {
  const normalizedUploads = normalizeUploadsUrl(rawPath);
  const mapped = mediaMap.get(normalizeMediaLookupKey(normalizedUploads));
  if (mapped) {
    return normalizeMediaPublicPath(mapped.publicPath);
  }

  const directKey = normalizeMediaLookupKey(normalizedUploads);
  if (catalogPaths.has(directKey)) {
    return directKey;
  }

  if (directKey.startsWith("/media/")) {
    return directKey;
  }

  return null;
}

async function loadContentForUsageScan(): Promise<AdminArticle[]> {
  const articles = await listAdminArticles();
  const pages = getRecoveredContentBundle().pages.map((page) => recoveredArticleToAdminArticle(page));
  const byId = new Map<string, AdminArticle>();
  for (const page of pages) {
    byId.set(page.id, page);
  }
  for (const article of articles) {
    byId.set(article.id, article);
  }
  return [...byId.values()];
}

async function computeMediaUsageIndex(): Promise<Map<string, MediaUsageEntry[]>> {
  const index = new Map<string, MediaUsageEntry[]>();
  const content = await loadContentForUsageScan();
  const mediaMap = getMediaMap();
  const catalogPaths = getCatalogPathSet();

  for (const article of content) {
    const rolesByPath = new Map<string, Set<MediaUsageRole>>();

    for (const { path, role } of collectArticlePaths(article)) {
      const publicPath = resolveToPublicPath(path, mediaMap, catalogPaths);
      if (!publicPath) {
        continue;
      }

      const roles = rolesByPath.get(publicPath) ?? new Set<MediaUsageRole>();
      roles.add(role);
      rolesByPath.set(publicPath, roles);
    }

    for (const [publicPath, roles] of rolesByPath) {
      const existing = index.get(publicPath) ?? [];
      const prior = existing.find((entry) => entry.articleId === article.id);
      if (prior) {
        prior.roles = [...new Set([...prior.roles, ...roles])];
        continue;
      }

      existing.push({
        articleId: article.id,
        title: article.title,
        pathname: article.pathname,
        source: article.source,
        roles: [...roles],
      });
      index.set(publicPath, existing);
    }
  }

  return index;
}

export function invalidateMediaUsageIndex(): void {
  cachedUsageIndex = null;
  cachedUsageIndexAt = 0;
  cachedCatalogPaths = null;
  inFlightUsageIndex = null;
}

export async function buildMediaUsageIndex(): Promise<Map<string, MediaUsageEntry[]>> {
  const now = Date.now();
  if (cachedUsageIndex && now - cachedUsageIndexAt < USAGE_INDEX_CACHE_MS) {
    return cachedUsageIndex;
  }

  if (!inFlightUsageIndex) {
    inFlightUsageIndex = computeMediaUsageIndex()
      .then((index) => {
        cachedUsageIndex = index;
        cachedUsageIndexAt = Date.now();
        return index;
      })
      .finally(() => {
        inFlightUsageIndex = null;
      });
  }

  return inFlightUsageIndex;
}

export async function getMediaUsage(publicPath: string): Promise<MediaUsageEntry[]> {
  const index = await buildMediaUsageIndex();
  return index.get(normalizeMediaPublicPath(publicPath)) ?? [];
}

export async function getMediaUsageCounts(): Promise<Map<string, number>> {
  const index = await buildMediaUsageIndex();
  return new Map([...index.entries()].map(([path, usages]) => [path, usages.length]));
}

export async function isMediaInUse(publicPath: string): Promise<boolean> {
  const usages = await getMediaUsage(publicPath);
  return usages.length > 0;
}
