import { getContentBundle } from "@/lib/content";
import { slugifyTitle, type TaxonomyTerm } from "@/lib/cms/schemas";
import { TopicDomainError } from "@/lib/cms/topics/errors";

export type KnownTaxonomy = {
  categories: TaxonomyTerm[];
  tagsBySlug: Map<string, TaxonomyTerm>;
};

export function loadKnownTaxonomy(): KnownTaxonomy {
  const bundle = getContentBundle();
  const tagsBySlug = new Map<string, TaxonomyTerm>();

  for (const article of bundle.articles) {
    for (const tag of article.tags) {
      if (!tagsBySlug.has(tag.slug)) {
        tagsBySlug.set(tag.slug, tag);
      }
    }
  }

  return {
    categories: bundle.categories,
    tagsBySlug,
  };
}

export function resolveSuggestedCategories(
  proposed: TaxonomyTerm[] | undefined,
  known: KnownTaxonomy,
): TaxonomyTerm[] {
  if (!proposed?.length) return [];

  const resolved: TaxonomyTerm[] = [];
  for (const term of proposed) {
    const match =
      known.categories.find((category) => category.slug === term.slug) ||
      known.categories.find(
        (category) => category.name.toLowerCase() === term.name.toLowerCase(),
      );
    if (!match) {
      throw new TopicDomainError(
        "VALIDATION_ERROR",
        `Unknown category suggestion "${term.slug || term.name}". Choose a known site category.`,
      );
    }
    if (!resolved.some((item) => item.id === match.id)) {
      resolved.push(match);
    }
  }
  return resolved;
}

export function resolveSuggestedTags(
  proposed: TaxonomyTerm[] | undefined,
  known: KnownTaxonomy,
): TaxonomyTerm[] {
  if (!proposed?.length) return [];

  const resolved: TaxonomyTerm[] = [];
  for (const term of proposed) {
    const slug = term.slug || slugifyTitle(term.name);
    const existing = known.tagsBySlug.get(slug);
    const normalized: TaxonomyTerm = existing ?? {
      id: term.id || `tag_${slug}`,
      name: term.name.trim() || slug,
      slug,
    };
    if (!resolved.some((item) => item.slug === normalized.slug)) {
      resolved.push(normalized);
    }
  }
  return resolved;
}
