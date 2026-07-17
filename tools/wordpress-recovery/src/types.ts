export type SqlScalar = string | null;

export type SqlRecord = Record<string, SqlScalar>;

export type WordPressTableSuffix =
  | "posts"
  | "postmeta"
  | "terms"
  | "term_taxonomy"
  | "term_relationships"
  | "users"
  | "usermeta"
  | "options";

export const WORDPRESS_TABLE_SUFFIXES: WordPressTableSuffix[] = [
  "posts",
  "postmeta",
  "terms",
  "term_taxonomy",
  "term_relationships",
  "users",
  "usermeta",
  "options",
];

export type ParsedWordPressDump = {
  sourcePath: string;
  inputFormat: "sql" | "sql.gz" | "zip";
  databaseName?: string;
  tablePrefix: string;
  tables: string[];
  records: Record<WordPressTableSuffix, SqlRecord[]>;
  /** Extra plugin tables keyed by suffix (e.g. aawp_products, prli_links). */
  extraRecords: Record<string, SqlRecord[]>;
};

export type ExtractedContent = {
  source: {
    path: string;
    format: ParsedWordPressDump["inputFormat"];
    databaseName?: string;
    tablePrefix: string;
  };
  summary: {
    publishedPosts: number;
    publishedPages: number;
    attachments: number;
    nonPublicContent: number;
    customPostTypes: number;
    orphanedAttachments: number;
  };
  content: Array<{
    id: string;
    type: "post" | "page";
    status: "publish";
    title: string;
    slug: string;
    parentId?: string;
    publishedAt?: string;
    modifiedAt?: string;
    authorId?: string;
    excerpt?: string;
    featuredMedia?: RecoveredFeaturedMedia;
    rawContent: string;
    requiresSanitization: true;
  }>;
  attachments: Array<{
    id: string;
    parentId?: string;
    title: string;
    slug: string;
    mimeType?: string;
    sourceUrl?: string;
    attachedFile?: string;
    width?: number;
    height?: number;
    alt?: string;
    caption?: string;
    sizes: RecoveredImageSize[];
    requiresMediaValidation: true;
  }>;
  reports: {
    nonPublicContent: ReportEntry[];
    customPostTypes: ReportEntry[];
    orphanedAttachments: ReportEntry[];
  };
};

export type RecoveredImageSize = {
  name: string;
  sourcePath: string;
  width: number;
  height: number;
};

export type RecoveredFeaturedMedia = {
  attachmentId: string;
  sourcePath: string;
  width?: number;
  height?: number;
  alt: string;
  caption?: string;
  sizes: RecoveredImageSize[];
};

export type ReportEntry = {
  id: string;
  type?: string;
  status?: string;
  title?: string;
  slug?: string;
  parentId?: string;
  reason: string;
  preview?: string;
  manualReview: boolean;
};
