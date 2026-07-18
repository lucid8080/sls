import { z } from "zod";
import { TaxonomyTermSchema } from "@/lib/cms/schemas";

export const ARTICLE_AI_SUGGESTION_FIELDS = [
  "title",
  "excerpt",
  "seoTitle",
  "seoDescription",
  "categories",
  "tags",
  "html",
] as const;

export const articleAiSuggestionFieldSchema = z.enum(ARTICLE_AI_SUGGESTION_FIELDS);

const trimmed = (max: number) => z.string().trim().max(max);
const nonEmptyTrimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const articleAiSuggestionSchema = z
  .object({
    title: nonEmptyTrimmed(5, 180).optional(),
    excerpt: trimmed(500).optional(),
    seoTitle: trimmed(70).optional(),
    seoDescription: trimmed(160).optional(),
    categories: z.array(TaxonomyTermSchema).max(8).optional(),
    tags: z.array(TaxonomyTermSchema).max(20).optional(),
    html: trimmed(200_000).optional(),
    rationale: trimmed(800).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "rationale"), {
    message: "At least one suggested field is required.",
  });

export const articleSuggestionApplySchema = z
  .object({
    expectedUpdatedAt: z.string().datetime(),
    selectedFields: z
      .array(articleAiSuggestionFieldSchema)
      .min(1)
      .max(ARTICLE_AI_SUGGESTION_FIELDS.length),
    suggestions: articleAiSuggestionSchema,
  })
  .strict();

export type ArticleAiSuggestion = z.infer<typeof articleAiSuggestionSchema>;
export type ArticleAiSuggestionField = z.infer<typeof articleAiSuggestionFieldSchema>;
export type ArticleSuggestionApplyInput = z.infer<typeof articleSuggestionApplySchema>;

export const ARTICLE_AI_SUGGESTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    excerpt: { type: "string" },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    categories: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "slug"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
        },
      },
    },
    tags: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "slug"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
        },
      },
    },
    html: { type: "string" },
    rationale: { type: "string" },
  },
  required: [
    "title",
    "excerpt",
    "seoTitle",
    "seoDescription",
    "categories",
    "tags",
    "html",
    "rationale",
  ],
} as const;
