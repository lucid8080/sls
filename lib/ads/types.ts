export type AdPageType = "article" | "page" | "home" | "archive";

export type AdPlacementGroup =
  | "global"
  | "article_layout"
  | "article_in_content"
  | "archive";

export type AdPlacementLocation =
  | "global"
  | "sidebar_rail"
  | "sidebar_rail_secondary"
  | "before_content"
  | "after_article"
  | "in_content";

export type AdPlacementDefinition = {
  key: string;
  label: string;
  description: string;
  ezoicId: number;
  group: AdPlacementGroup;
  pageTypes: AdPageType[];
  location: AdPlacementLocation;
  mockSize: { width: number; height: number };
  defaultEnabled: boolean;
  afterParagraph?: number;
  coverageNote?: string;
};

export type AdPlacementState = {
  enabled: boolean;
};

export type AdSettings = {
  globalEnabled: boolean;
  placements: Record<string, AdPlacementState>;
};

export type PublicAdConfig = {
  globalEnabled: boolean;
  enabledEzoicIds: number[];
  disabledEzoicIds: number[];
  placements: Record<string, boolean>;
};
