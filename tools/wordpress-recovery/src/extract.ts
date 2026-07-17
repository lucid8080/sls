import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExtractedContent, ParsedWordPressDump, RecoveredFeaturedMedia, RecoveredImageSize, ReportEntry, SqlRecord } from "./types.js";

const PUBLIC_TYPES = new Set(["post", "page"]);

export function extractContent(dump: ParsedWordPressDump): ExtractedContent {
  const posts = dump.records.posts;
  const postMeta = groupPostMeta(dump.records.postmeta);
  const published = posts.filter(
    (post) => PUBLIC_TYPES.has(getString(post, "post_type")) && getString(post, "post_status") === "publish",
  );
  const attachments = posts.filter((post) => getString(post, "post_type") === "attachment");
  const publishedIds = new Set(published.map((post) => getString(post, "ID")));
  const attachmentsById = new Map(attachments.map((attachment) => [getString(attachment, "ID"), attachment]));

  const nonPublicContent = posts
    .filter((post) => isNonPublicReportable(post))
    .map((post) => reportEntry(post, reasonForNonPublic(post)));

  const customPostTypes = posts
    .filter((post) => isCustomPostType(post))
    .map((post) => reportEntry(post, "Custom post type is not published automatically."));

  const orphanedAttachments = attachments
    .filter((attachment) => {
      const parentId = getString(attachment, "post_parent");
      return !parentId || parentId === "0" || !publishedIds.has(parentId);
    })
    .map((attachment) => reportEntry(attachment, "Attachment is not associated with a published post or page."));

  const publicContent = published.map((post) => {
    const id = getString(post, "ID");
    const featuredMedia = recoverFeaturedMedia(postMeta.get(id)?.get("_thumbnail_id"), attachmentsById, postMeta);

    return {
      id,
      type: getString(post, "post_type") as "post" | "page",
      status: "publish" as const,
      title: getString(post, "post_title"),
      slug: getString(post, "post_name"),
      parentId: optionalString(post, "post_parent", "0"),
      publishedAt: optionalString(post, "post_date_gmt") ?? optionalString(post, "post_date"),
      modifiedAt: optionalString(post, "post_modified_gmt") ?? optionalString(post, "post_modified"),
      authorId: optionalString(post, "post_author", "0"),
      excerpt: optionalString(post, "post_excerpt"),
      featuredMedia,
      rawContent: getString(post, "post_content"),
      requiresSanitization: true as const,
    };
  });

  const extractedAttachments = attachments.map((attachment) => {
    const id = getString(attachment, "ID");
    const attachmentMeta = postMeta.get(id);
    const metadata = parseAttachmentMetadata(attachmentMeta?.get("_wp_attachment_metadata"));
    const attachedFile = attachmentMeta?.get("_wp_attached_file") ?? metadata?.sourcePath;

    return {
      id,
      parentId: optionalString(attachment, "post_parent", "0"),
      title: getString(attachment, "post_title"),
      slug: getString(attachment, "post_name"),
      mimeType: optionalString(attachment, "post_mime_type"),
      sourceUrl: optionalString(attachment, "guid"),
      attachedFile,
      width: metadata?.width,
      height: metadata?.height,
      alt: attachmentMeta?.get("_wp_attachment_image_alt") ?? "",
      caption: optionalString(attachment, "post_excerpt"),
      sizes: metadata?.sizes ?? [],
      requiresMediaValidation: true as const,
    };
  });

  return {
    source: {
      path: dump.sourcePath,
      format: dump.inputFormat,
      databaseName: dump.databaseName,
      tablePrefix: dump.tablePrefix,
    },
    summary: {
      publishedPosts: publicContent.filter((post) => post.type === "post").length,
      publishedPages: publicContent.filter((post) => post.type === "page").length,
      attachments: extractedAttachments.length,
      nonPublicContent: nonPublicContent.length,
      customPostTypes: customPostTypes.length,
      orphanedAttachments: orphanedAttachments.length,
    },
    content: publicContent,
    attachments: extractedAttachments,
    reports: {
      nonPublicContent,
      customPostTypes,
      orphanedAttachments,
    },
  };
}

export function writeExtraction(outputDir: string, extraction: ExtractedContent): void {
  mkdirSync(join(outputDir, "reports"), { recursive: true });

  writeJson(join(outputDir, "published-content.json"), extraction.content);
  writeJson(join(outputDir, "attachments.json"), extraction.attachments);
  writeJson(join(outputDir, "summary.json"), {
    source: extraction.source,
    summary: extraction.summary,
  });
  writeJson(join(outputDir, "reports", "non-public-content.json"), extraction.reports.nonPublicContent);
  writeJson(join(outputDir, "reports", "custom-post-types.json"), extraction.reports.customPostTypes);
  writeJson(join(outputDir, "reports", "orphaned-attachments.json"), extraction.reports.orphanedAttachments);
}

function isNonPublicReportable(post: SqlRecord): boolean {
  const type = getString(post, "post_type");
  const status = getString(post, "post_status");

  if (type === "attachment") {
    return false;
  }

  if (PUBLIC_TYPES.has(type)) {
    return status !== "publish";
  }

  return type === "revision" || type === "nav_menu_item" || status !== "publish";
}

function isCustomPostType(post: SqlRecord): boolean {
  const type = getString(post, "post_type");
  return type !== "" && !PUBLIC_TYPES.has(type) && type !== "attachment" && type !== "revision";
}

function reasonForNonPublic(post: SqlRecord): string {
  const type = getString(post, "post_type");
  const status = getString(post, "post_status");

  if (type === "revision") {
    return "Revision is not published automatically.";
  }

  if (type === "nav_menu_item") {
    return "Navigation menu item is not article content.";
  }

  if (PUBLIC_TYPES.has(type) && status !== "publish") {
    return `Public content type has non-publish status '${status}'.`;
  }

  return `Post type '${type}' with status '${status}' requires manual review.`;
}

function reportEntry(post: SqlRecord, reason: string): ReportEntry {
  return {
    id: getString(post, "ID"),
    type: optionalString(post, "post_type"),
    status: optionalString(post, "post_status"),
    title: optionalString(post, "post_title"),
    slug: optionalString(post, "post_name"),
    parentId: optionalString(post, "post_parent", "0"),
    reason,
    preview: escapedPreview(getString(post, "post_content") || getString(post, "post_excerpt")),
    manualReview: true,
  };
}

function groupPostMeta(rows: SqlRecord[]): Map<string, Map<string, string>> {
  const grouped = new Map<string, Map<string, string>>();

  for (const row of rows) {
    const postId = getString(row, "post_id");
    const key = getString(row, "meta_key");
    const value = getString(row, "meta_value");

    if (!postId || !key) {
      continue;
    }

    if (!grouped.has(postId)) {
      grouped.set(postId, new Map());
    }

    grouped.get(postId)?.set(key, value);
  }

  return grouped;
}

function recoverFeaturedMedia(
  attachmentId: string | undefined,
  attachmentsById: Map<string, SqlRecord>,
  postMeta: Map<string, Map<string, string>>,
): RecoveredFeaturedMedia | undefined {
  if (!attachmentId) {
    return undefined;
  }

  const attachment = attachmentsById.get(attachmentId);
  const attachmentMeta = postMeta.get(attachmentId);
  if (!attachment || !attachmentMeta) {
    return undefined;
  }

  const metadata = parseAttachmentMetadata(attachmentMeta.get("_wp_attachment_metadata"));
  const sourcePath = attachmentMeta.get("_wp_attached_file") ?? metadata?.sourcePath;
  if (!sourcePath) {
    return undefined;
  }

  return {
    attachmentId,
    sourcePath: normalizeSlashes(sourcePath),
    width: metadata?.width,
    height: metadata?.height,
    alt: attachmentMeta.get("_wp_attachment_image_alt") ?? getString(attachment, "post_title"),
    caption: optionalString(attachment, "post_excerpt"),
    sizes: metadata?.sizes ?? [],
  };
}

function parseAttachmentMetadata(value: string | undefined): { sourcePath?: string; width?: number; height?: number; sizes: RecoveredImageSize[] } | undefined {
  if (!value) {
    return undefined;
  }

  const sourcePath = matchString(value, /s:4:"file";s:\d+:"([^"]+)"/);
  const directory = sourcePath?.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
  const sizes: RecoveredImageSize[] = [];
  const sizeRe = /s:\d+:"([^"]+)";a:\d+:\{s:4:"file";s:\d+:"([^"]+)";s:5:"width";i:(\d+);s:6:"height";i:(\d+)/g;

  for (const match of value.matchAll(sizeRe)) {
    const name = match[1];
    const file = match[2];
    const width = Number(match[3]);
    const height = Number(match[4]);

    if (!name || !file || !Number.isFinite(width) || !Number.isFinite(height)) {
      continue;
    }

    sizes.push({
      name,
      sourcePath: normalizeSlashes(directory ? `${directory}/${file}` : file),
      width,
      height,
    });
  }

  return {
    sourcePath: sourcePath ? normalizeSlashes(sourcePath) : undefined,
    width: matchNumber(value, /s:5:"width";i:(\d+)/),
    height: matchNumber(value, /s:6:"height";i:(\d+)/),
    sizes,
  };
}

function matchString(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

function matchNumber(value: string, pattern: RegExp): number | undefined {
  const raw = value.match(pattern)?.[1];
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalString(record: SqlRecord, key: string, omitValue?: string): string | undefined {
  const value = getString(record, key);
  return value && value !== omitValue ? value : undefined;
}

function getString(record: SqlRecord, key: string): string {
  return record[key] ?? "";
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapedPreview(value: string, limit = 160): string | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, limit);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
