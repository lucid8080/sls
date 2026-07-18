import { z } from "zod";
import {
  TOPIC_ACTIVITY_EVENTS,
  TOPIC_ANGLE_MAX,
  TOPIC_EXTRACTED_TEXT_MAX,
  TOPIC_INPUT_MAX,
  TOPIC_NOTES_MAX,
  TOPIC_PRIORITIES,
  TOPIC_SEARCH_INTENTS,
  TOPIC_SOURCE_FETCH_STATUSES,
  TOPIC_SOURCE_TYPES,
  TOPIC_STATUSES,
  TOPIC_SUMMARY_MAX,
  TOPIC_TITLE_MAX,
} from "./constants";

const trimmed = (max: number) => z.string().trim().max(max);
const nonEmptyTrimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Only http(s) URLs — Zod's url() otherwise accepts javascript: and other schemes. */
export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must use http or https." },
  );

export const topicSourceTypeSchema = z.enum(TOPIC_SOURCE_TYPES);
export const topicSourceFetchStatusSchema = z.enum(TOPIC_SOURCE_FETCH_STATUSES);
export const topicStatusSchema = z.enum(TOPIC_STATUSES);
export const topicPrioritySchema = z.enum(TOPIC_PRIORITIES);
export const topicSearchIntentSchema = z.enum(TOPIC_SEARCH_INTENTS);
export const topicActivityEventSchema = z.enum(TOPIC_ACTIVITY_EVENTS);

export const topicPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const topicSortSchema = z.enum(["created_at", "updated_at", "priority", "status", "title"]);
export const topicSortDirectionSchema = z.enum(["asc", "desc"]);

export const topicListFiltersSchema = topicPaginationSchema.extend({
  search: trimmed(200).optional(),
  status: topicStatusSchema.optional(),
  statuses: z.array(topicStatusSchema).max(TOPIC_STATUSES.length).optional(),
  platform: trimmed(80).optional(),
  category: trimmed(150).optional(),
  priority: topicPrioritySchema.optional(),
  hasDuplicateWarning: z.coerce.boolean().optional(),
  sort: topicSortSchema.default("updated_at"),
  direction: topicSortDirectionSchema.default("desc"),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
});

export const createManualTopicSourceSchema = z
  .object({
    inputValue: nonEmptyTrimmed(1, TOPIC_INPUT_MAX),
    sourceType: z.enum(["manual", "keyword"]).default("manual"),
    category: trimmed(150).optional(),
    editorNotes: trimmed(TOPIC_NOTES_MAX).optional(),
    priority: topicPrioritySchema.optional(),
  })
  .strict();

export const createUrlTopicSourceSchema = z
  .object({
    inputValue: nonEmptyTrimmed(1, TOPIC_INPUT_MAX),
    sourceUrl: httpUrlSchema,
    sourceType: z.enum(["url", "social", "video", "article"]).optional(),
    category: trimmed(150).optional(),
    editorNotes: trimmed(TOPIC_NOTES_MAX).optional(),
    priority: topicPrioritySchema.optional(),
  })
  .strict();

export const createTopicSourceSchema = z.union([
  createUrlTopicSourceSchema,
  createManualTopicSourceSchema,
]);

export const updateTopicSourceSchema = z
  .object({
    editorNotes: trimmed(TOPIC_NOTES_MAX).nullable().optional(),
    originalText: trimmed(TOPIC_EXTRACTED_TEXT_MAX).nullable().optional(),
    pageTitle: trimmed(300).nullable().optional(),
    pageDescription: trimmed(1000).nullable().optional(),
    authorName: trimmed(200).nullable().optional(),
    sourceUrl: httpUrlSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const createTopicSchema = z.object({
  title: nonEmptyTrimmed(5, TOPIC_TITLE_MAX),
  workingTitle: trimmed(TOPIC_TITLE_MAX).optional(),
  summary: trimmed(TOPIC_SUMMARY_MAX).optional(),
  angle: trimmed(TOPIC_ANGLE_MAX).optional(),
  readerProblem: trimmed(500).optional(),
  targetAudience: trimmed(200).optional(),
  category: trimmed(150).optional(),
  primaryKeyword: trimmed(150).optional(),
  secondaryKeywords: z.array(trimmed(100)).max(10).optional(),
  searchIntent: topicSearchIntentSchema.optional(),
  relevanceScore: z.number().int().min(0).max(100).optional(),
  freshnessScore: z.number().int().min(0).max(100).optional(),
  evergreenScore: z.number().int().min(0).max(100).optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
  priority: topicPrioritySchema.optional(),
  status: topicStatusSchema.optional(),
  editorNotes: trimmed(TOPIC_NOTES_MAX).optional(),
  primarySourceId: z.string().uuid().optional(),
  sourceIds: z.array(z.string().uuid()).max(20).optional(),
});

export const updateTopicSchema = z
  .object({
    title: nonEmptyTrimmed(1, TOPIC_TITLE_MAX).optional(),
    workingTitle: trimmed(TOPIC_TITLE_MAX).nullable().optional(),
    summary: trimmed(TOPIC_SUMMARY_MAX).nullable().optional(),
    angle: trimmed(TOPIC_ANGLE_MAX).nullable().optional(),
    readerProblem: trimmed(500).nullable().optional(),
    targetAudience: trimmed(200).nullable().optional(),
    category: trimmed(150).nullable().optional(),
    primaryKeyword: trimmed(150).nullable().optional(),
    secondaryKeywords: z.array(trimmed(100)).max(10).optional(),
    searchIntent: topicSearchIntentSchema.nullable().optional(),
    relevanceScore: z.number().int().min(0).max(100).nullable().optional(),
    freshnessScore: z.number().int().min(0).max(100).nullable().optional(),
    evergreenScore: z.number().int().min(0).max(100).nullable().optional(),
    confidenceScore: z.number().int().min(0).max(100).nullable().optional(),
    priority: topicPrioritySchema.optional(),
    editorNotes: trimmed(TOPIC_NOTES_MAX).nullable().optional(),
    rejectionReason: trimmed(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const topicStatusChangeSchema = z.object({
  toStatus: topicStatusSchema,
  rejectionReason: trimmed(1000).optional(),
  notes: trimmed(TOPIC_NOTES_MAX).optional(),
});

export const topicBulkActionSchema = z.object({
  topicIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum([
    "approve",
    "archive",
    "restore",
    "reject",
    "set_priority",
    "set_category",
  ]),
  priority: topicPrioritySchema.optional(),
  category: trimmed(150).optional(),
  rejectionReason: trimmed(1000).optional(),
});

export const duplicateCheckSchema = z.object({
  title: trimmed(TOPIC_TITLE_MAX).optional(),
  primaryKeyword: trimmed(150).optional(),
  normalizedUrl: trimmed(2048).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const convertTopicToArticleSchema = z.object({
  titleOverride: trimmed(TOPIC_TITLE_MAX).optional(),
  includeBriefInHtml: z.boolean().optional().default(false),
});

export const scheduleTopicSchema = z.object({
  calendarDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "calendarDate must be YYYY-MM-DD"),
  contentType: trimmed(40).optional(),
  categorySlug: trimmed(150).optional(),
  notes: trimmed(TOPIC_NOTES_MAX).optional(),
  forceReplaceExisting: z.boolean().optional().default(false),
});

export const mergeTopicsSchema = z.object({
  primaryTopicId: z.string().uuid(),
  secondaryTopicId: z.string().uuid(),
}).refine((value) => value.primaryTopicId !== value.secondaryTopicId, {
  message: "primaryTopicId and secondaryTopicId must differ.",
});

export const dismissDuplicateSchema = z.object({
  entityType: z.enum(["topic", "article", "source"]),
  entityId: z.string().min(1).max(80),
  notes: trimmed(500).optional(),
});

export const TOPIC_AI_SUGGESTION_FIELDS = [
  "title",
  "workingTitle",
  "summary",
  "angle",
  "readerProblem",
  "targetAudience",
  "category",
  "primaryKeyword",
  "secondaryKeywords",
  "searchIntent",
  "relevanceScore",
  "freshnessScore",
  "evergreenScore",
  "confidenceScore",
  "priority",
] as const;

export const topicAiSuggestionFieldSchema = z.enum(TOPIC_AI_SUGGESTION_FIELDS);

/** Strict AI proposal payload — no status/link/workflow fields. */
export const topicAiSuggestionSchema = z
  .object({
    title: nonEmptyTrimmed(5, TOPIC_TITLE_MAX).optional(),
    workingTitle: trimmed(TOPIC_TITLE_MAX).optional(),
    summary: trimmed(TOPIC_SUMMARY_MAX).optional(),
    angle: trimmed(TOPIC_ANGLE_MAX).optional(),
    readerProblem: trimmed(500).optional(),
    targetAudience: trimmed(200).optional(),
    category: trimmed(150).optional(),
    primaryKeyword: trimmed(150).optional(),
    secondaryKeywords: z.array(trimmed(100)).max(10).optional(),
    searchIntent: topicSearchIntentSchema.optional(),
    relevanceScore: z.number().int().min(0).max(100).optional(),
    freshnessScore: z.number().int().min(0).max(100).optional(),
    evergreenScore: z.number().int().min(0).max(100).optional(),
    confidenceScore: z.number().int().min(0).max(100).optional(),
    priority: topicPrioritySchema.optional(),
    rationale: trimmed(800).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "rationale"), {
    message: "At least one suggested field is required.",
  });

export const topicSuggestionApplySchema = z
  .object({
    expectedUpdatedAt: z.string().datetime(),
    selectedFields: z.array(topicAiSuggestionFieldSchema).min(1).max(TOPIC_AI_SUGGESTION_FIELDS.length),
    suggestions: topicAiSuggestionSchema,
  })
  .strict();

export const fetchedMetadataSchema = z.object({
  finalUrl: httpUrlSchema.optional(),
  pageTitle: trimmed(300).optional(),
  pageDescription: trimmed(1000).optional(),
  authorName: trimmed(200).optional(),
  thumbnailUrl: httpUrlSchema.optional(),
  publishedAt: z.string().datetime().optional(),
  extractedText: trimmed(TOPIC_EXTRACTED_TEXT_MAX).optional(),
  platform: trimmed(80).optional(),
  domain: trimmed(253).optional(),
  rawMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateManualTopicSourceInput = z.infer<typeof createManualTopicSourceSchema>;
export type CreateUrlTopicSourceInput = z.infer<typeof createUrlTopicSourceSchema>;
export type CreateTopicSourceInput = z.infer<typeof createTopicSourceSchema>;
export type UpdateTopicSourceInput = z.infer<typeof updateTopicSourceSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type TopicStatusChangeInput = z.infer<typeof topicStatusChangeSchema>;
export type TopicBulkActionInput = z.infer<typeof topicBulkActionSchema>;
export type TopicListFilters = z.infer<typeof topicListFiltersSchema>;
export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
export type ConvertTopicToArticleInput = z.infer<typeof convertTopicToArticleSchema>;
export type ScheduleTopicInput = z.infer<typeof scheduleTopicSchema>;
export type MergeTopicsInput = z.infer<typeof mergeTopicsSchema>;
export type DismissDuplicateInput = z.infer<typeof dismissDuplicateSchema>;
export type FetchedMetadata = z.infer<typeof fetchedMetadataSchema>;
export type TopicAiSuggestion = z.infer<typeof topicAiSuggestionSchema>;
export type TopicSuggestionApplyInput = z.infer<typeof topicSuggestionApplySchema>;
export type TopicAiSuggestionField = z.infer<typeof topicAiSuggestionFieldSchema>;
