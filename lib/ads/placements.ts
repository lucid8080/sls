import type { AdPlacementDefinition } from "@/lib/ads/types";

const layoutPlacements: AdPlacementDefinition[] = [
  {
    key: "sidebar_primary",
    label: "Sidebar primary",
    description: "Sticky rail ad between the table of contents and trending list.",
    ezoicId: 147,
    group: "article_layout",
    pageTypes: ["article"],
    location: "sidebar_rail",
    mockSize: { width: 280, height: 250 },
    defaultEnabled: true,
    coverageNote: "Hidden when the article has fewer than 3 headings and no trending rail.",
  },
  {
    key: "sidebar_bottom",
    label: "Sidebar bottom",
    description: "Lower sidebar slot below trending links.",
    ezoicId: 151,
    group: "article_layout",
    pageTypes: ["article"],
    location: "sidebar_rail_secondary",
    mockSize: { width: 280, height: 250 },
    defaultEnabled: true,
    coverageNote: "Same rail visibility rules as sidebar primary.",
  },
  {
    key: "after_content",
    label: "After article content",
    description: "Display slot below the article body and above share links.",
    ezoicId: 146,
    group: "article_layout",
    pageTypes: ["article", "page"],
    location: "after_article",
    mockSize: { width: 728, height: 90 },
    defaultEnabled: true,
  },
  {
    key: "native_bottom",
    label: "Native bottom",
    description: "Native-style unit after the article body.",
    ezoicId: 611,
    group: "article_layout",
    pageTypes: ["article", "page"],
    location: "after_article",
    mockSize: { width: 728, height: 280 },
    defaultEnabled: true,
  },
];

const inContentBase: Array<Omit<AdPlacementDefinition, "group" | "pageTypes" | "location">> = [
  {
    key: "under_page_title",
    label: "Under page title",
    description: "First in-content slot after the opening paragraph.",
    ezoicId: 145,
    mockSize: { width: 728, height: 90 },
    defaultEnabled: true,
    afterParagraph: 1,
  },
  {
    key: "under_first_paragraph",
    label: "Under first paragraph block",
    description: "Inserted after paragraph 3 (legacy Ezoic under-first-paragraph rule).",
    ezoicId: 153,
    mockSize: { width: 728, height: 250 },
    defaultEnabled: true,
    afterParagraph: 3,
  },
  {
    key: "under_second_paragraph",
    label: "Under second paragraph block",
    description: "Inserted after paragraph 6.",
    ezoicId: 154,
    mockSize: { width: 728, height: 250 },
    defaultEnabled: true,
    afterParagraph: 6,
  },
  {
    key: "mid_content",
    label: "Mid content",
    description: "Inserted after paragraph 9.",
    ezoicId: 155,
    mockSize: { width: 728, height: 250 },
    defaultEnabled: true,
    afterParagraph: 9,
  },
  {
    key: "long_content",
    label: "Long content",
    description: "Inserted after paragraph 12.",
    ezoicId: 156,
    mockSize: { width: 728, height: 250 },
    defaultEnabled: true,
    afterParagraph: 12,
  },
  {
    key: "longer_content",
    label: "Longer content",
    description: "Inserted after paragraph 15.",
    ezoicId: 157,
    mockSize: { width: 728, height: 250 },
    defaultEnabled: true,
    afterParagraph: 15,
  },
  {
    key: "longest_content",
    label: "Longest content",
    description: "Inserted after paragraph 18.",
    ezoicId: 158,
    mockSize: { width: 728, height: 250 },
    defaultEnabled: true,
    afterParagraph: 18,
  },
];

const extendedInContentRules: Array<{ key: string; ezoicId: number; afterParagraph: number }> = [
  { key: "incontent_5", ezoicId: 159, afterParagraph: 21 },
  { key: "incontent_6", ezoicId: 160, afterParagraph: 24 },
  { key: "incontent_7", ezoicId: 161, afterParagraph: 27 },
  { key: "incontent_8", ezoicId: 162, afterParagraph: 30 },
  { key: "incontent_9", ezoicId: 163, afterParagraph: 33 },
  { key: "incontent_10", ezoicId: 164, afterParagraph: 36 },
  { key: "incontent_11", ezoicId: 165, afterParagraph: 39 },
  { key: "incontent_12", ezoicId: 166, afterParagraph: 42 },
  { key: "incontent_13", ezoicId: 167, afterParagraph: 45 },
  { key: "incontent_14", ezoicId: 168, afterParagraph: 48 },
  { key: "incontent_15", ezoicId: 169, afterParagraph: 51 },
  { key: "incontent_16", ezoicId: 170, afterParagraph: 54 },
  { key: "incontent_17", ezoicId: 171, afterParagraph: 57 },
  { key: "incontent_18", ezoicId: 172, afterParagraph: 60 },
  { key: "incontent_19", ezoicId: 173, afterParagraph: 63 },
  { key: "incontent_20", ezoicId: 174, afterParagraph: 66 },
  { key: "incontent_21", ezoicId: 175, afterParagraph: 69 },
  { key: "incontent_22", ezoicId: 176, afterParagraph: 72 },
  { key: "incontent_23", ezoicId: 177, afterParagraph: 75 },
  { key: "incontent_24", ezoicId: 178, afterParagraph: 78 },
  { key: "incontent_25", ezoicId: 179, afterParagraph: 81 },
  { key: "incontent_26", ezoicId: 180, afterParagraph: 84 },
  { key: "incontent_27", ezoicId: 181, afterParagraph: 87 },
  { key: "incontent_28", ezoicId: 182, afterParagraph: 90 },
  { key: "incontent_29", ezoicId: 183, afterParagraph: 93 },
  { key: "incontent_30", ezoicId: 184, afterParagraph: 96 },
  { key: "incontent_31", ezoicId: 185, afterParagraph: 99 },
  { key: "incontent_32", ezoicId: 186, afterParagraph: 102 },
  { key: "incontent_33", ezoicId: 187, afterParagraph: 105 },
  { key: "incontent_34", ezoicId: 188, afterParagraph: 108 },
  { key: "incontent_35", ezoicId: 189, afterParagraph: 111 },
  { key: "incontent_36", ezoicId: 190, afterParagraph: 114 },
  { key: "incontent_37", ezoicId: 191, afterParagraph: 117 },
  { key: "incontent_38", ezoicId: 192, afterParagraph: 120 },
  { key: "incontent_39", ezoicId: 193, afterParagraph: 123 },
  { key: "incontent_40", ezoicId: 194, afterParagraph: 126 },
  { key: "incontent_41", ezoicId: 195, afterParagraph: 129 },
  { key: "incontent_42", ezoicId: 196, afterParagraph: 132 },
  { key: "incontent_43", ezoicId: 197, afterParagraph: 135 },
  { key: "incontent_44", ezoicId: 198, afterParagraph: 138 },
  { key: "incontent_45", ezoicId: 199, afterParagraph: 141 },
];

const extendedInContent: AdPlacementDefinition[] = extendedInContentRules.map((rule) => ({
  key: rule.key,
  label: `In-content ${rule.key.replace("incontent_", "")}`,
  description: `Inserted after paragraph ${rule.afterParagraph} on long articles.`,
  ezoicId: rule.ezoicId,
  group: "article_in_content" as const,
  pageTypes: ["article" as const],
  location: "in_content" as const,
  mockSize: { width: 728, height: 250 },
  defaultEnabled: true,
  afterParagraph: rule.afterParagraph,
}));

const inContentPlacements: AdPlacementDefinition[] = inContentBase.map((placement) => ({
  ...placement,
  group: "article_in_content",
  pageTypes: ["article"],
  location: "in_content",
}));

export const AD_PLACEMENTS: AdPlacementDefinition[] = [
  ...layoutPlacements,
  ...inContentPlacements,
  ...extendedInContent,
];

export const AD_PLACEMENT_MAP = new Map(AD_PLACEMENTS.map((placement) => [placement.key, placement]));

export const AD_PLACEMENT_GROUPS: Array<{ id: AdPlacementDefinition["group"]; label: string }> = [
  { id: "global", label: "Global" },
  { id: "article_layout", label: "Article layout" },
  { id: "article_in_content", label: "In-content" },
  { id: "archive", label: "Archives" },
];

export function getPlacementByKey(key: string): AdPlacementDefinition | undefined {
  return AD_PLACEMENT_MAP.get(key);
}

export function getInContentPlacements(): AdPlacementDefinition[] {
  return AD_PLACEMENTS.filter((placement) => placement.location === "in_content" && placement.afterParagraph)
    .sort((a, b) => (a.afterParagraph ?? 0) - (b.afterParagraph ?? 0));
}

export function getPlacementsForPageType(pageType: AdPlacementDefinition["pageTypes"][number]): AdPlacementDefinition[] {
  return AD_PLACEMENTS.filter((placement) => placement.pageTypes.includes(pageType));
}
