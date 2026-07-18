export type SearchIndexEntry = {
  id: string;
  title: string;
  pathname: string;
  excerpt?: string;
  publishedAt: string;
  readingMinutes: number;
  authorName?: string;
  categoryName?: string;
  categorySlug?: string;
  imageSrc?: string;
  imageWidth?: number;
  imageHeight?: number;
  haystack: string;
};

export function searchIndex(query: string, index: SearchIndexEntry[]): SearchIndexEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return index.filter((entry) => entry.haystack.includes(normalized)).slice(0, 40);
}
