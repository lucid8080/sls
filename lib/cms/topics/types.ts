import type {
  TopicActivityRow,
  TopicRow,
  TopicSourceLinkRow,
  TopicSourceRow,
} from "@/lib/cms/db/schema";
import {
  TOPIC_ACTIVITY_EVENTS,
  TOPIC_PRIORITIES,
  TOPIC_SEARCH_INTENTS,
  TOPIC_SOURCE_FETCH_STATUSES,
  TOPIC_SOURCE_TYPES,
  TOPIC_STATUSES,
} from "./constants";

export type {
  ConvertTopicToArticleInput,
  CreateManualTopicSourceInput,
  CreateTopicInput,
  CreateTopicSourceInput,
  CreateUrlTopicSourceInput,
  DismissDuplicateInput,
  DuplicateCheckInput,
  FetchedMetadata,
  MergeTopicsInput,
  ScheduleTopicInput,
  TopicAiSuggestion,
  TopicAiSuggestionField,
  TopicBulkActionInput,
  TopicListFilters,
  TopicStatusChangeInput,
  TopicSuggestionApplyInput,
  UpdateTopicInput,
  UpdateTopicSourceInput,
} from "./schemas";

export type TopicPriority = (typeof TOPIC_PRIORITIES)[number];
export type TopicSourceType = (typeof TOPIC_SOURCE_TYPES)[number];
export type TopicSourceFetchStatus = (typeof TOPIC_SOURCE_FETCH_STATUSES)[number];
export type TopicStatus = (typeof TOPIC_STATUSES)[number];
export type TopicSearchIntent = (typeof TOPIC_SEARCH_INTENTS)[number];
export type TopicActivityEvent = (typeof TOPIC_ACTIVITY_EVENTS)[number];

export type TopicWithSources = TopicRow & {
  primarySource: TopicSourceRow | null;
  sources: TopicSourceRow[];
  links: TopicSourceLinkRow[];
};

export type TopicListItem = {
  id: string;
  title: string;
  workingTitle: string | null;
  summary: string | null;
  angle: string | null;
  status: TopicStatus;
  priority: TopicPriority;
  category: string | null;
  primaryKeyword: string | null;
  relevanceScore: number | null;
  platform: string | null;
  domain: string | null;
  sourceType: TopicSourceType | null;
  articleId: string | null;
  calendarEntryId: string | null;
  updatedAt: string;
  createdAt: string;
  hasDuplicateWarning?: boolean;
};

export type TopicStatusCounts = Record<TopicStatus, number>;

export type DuplicateCandidate = {
  entityType: "topic" | "article" | "source";
  entityId: string;
  title: string;
  score: number;
  reasons: string[];
  status?: string;
  publishedAt?: string;
};

export type RecordTopicActivityInput = {
  topicId?: string | null;
  sourceId?: string | null;
  eventType: TopicActivityEvent;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TopicActivityListItem = TopicActivityRow;

export type BulkActionResult = {
  succeeded: string[];
  failed: Array<{ topicId: string; code: string; message: string }>;
};
