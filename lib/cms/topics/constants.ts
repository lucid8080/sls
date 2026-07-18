export const TOPIC_SOURCE_TYPES = [
  "manual",
  "keyword",
  "url",
  "social",
  "video",
  "article",
] as const;

export const TOPIC_SOURCE_FETCH_STATUSES = [
  "not_required",
  "pending",
  "processing",
  "completed",
  "limited",
  "failed",
] as const;

export const TOPIC_STATUSES = [
  "inbox",
  "processing",
  "needs_review",
  "approved",
  "scheduled",
  "drafting",
  "published",
  "rejected",
  "archived",
] as const;

export const TOPIC_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const TOPIC_SEARCH_INTENTS = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
  "discovery",
] as const;

export const TOPIC_ACTIVITY_EVENTS = [
  "source_created",
  "source_updated",
  "source_fetch_started",
  "source_fetch_completed",
  "source_fetch_limited",
  "source_fetch_failed",
  "topic_created",
  "topic_updated",
  "topic_ai_suggestions_generated",
  "topic_ai_suggestions_applied",
  "topic_approved",
  "topic_rejected",
  "topic_archived",
  "topic_restored",
  "duplicate_dismissed",
  "topic_scheduled",
  "article_draft_created",
  "topic_published",
  "topics_merged",
] as const;

/** Aggregate character budget for untrusted source evidence sent to OpenRouter. */
export const TOPIC_AI_MAX_SOURCE_CHARS_DEFAULT = 12_000;
export const TOPIC_AI_MAX_SOURCES_IN_PROMPT = 8;

/** User-facing status labels for Topic Inbox. */
export const TOPIC_STATUS_LABELS: Record<(typeof TOPIC_STATUSES)[number], string> = {
  inbox: "Inbox",
  processing: "Processing",
  needs_review: "Needs Review",
  approved: "Approved",
  scheduled: "Scheduled",
  drafting: "Drafting",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};

export const ALLOWED_TOPIC_TRANSITIONS = {
  inbox: ["processing", "needs_review", "approved", "rejected", "archived"],
  processing: ["needs_review", "inbox", "rejected"],
  needs_review: ["approved", "rejected", "archived"],
  approved: ["scheduled", "drafting", "archived"],
  scheduled: ["drafting", "approved", "archived"],
  drafting: ["published", "approved", "archived"],
  published: ["archived"],
  rejected: ["inbox", "archived"],
  archived: ["inbox"],
} as const;

export const TOPIC_ACTIVITY_METADATA_MAX_KEYS = 24;
export const TOPIC_ACTIVITY_METADATA_MAX_STRING = 500;
export const TOPIC_ACTIVITY_METADATA_MAX_DEPTH = 2;

export const TOPIC_TITLE_MAX = 180;
export const TOPIC_SUMMARY_MAX = 1200;
export const TOPIC_ANGLE_MAX = 600;
export const TOPIC_NOTES_MAX = 4000;
export const TOPIC_EXTRACTED_TEXT_MAX = 50_000;
export const TOPIC_INPUT_MAX = 4000;
