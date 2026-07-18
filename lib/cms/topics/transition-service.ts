import { ALLOWED_TOPIC_TRANSITIONS, TOPIC_STATUS_LABELS } from "./constants";
import { TopicDomainError } from "./errors";
import type { TopicStatus } from "./types";

export type AllowedTopicTransitions = typeof ALLOWED_TOPIC_TRANSITIONS;

export function getAllowedTransitions(from: TopicStatus): readonly TopicStatus[] {
  return ALLOWED_TOPIC_TRANSITIONS[from];
}

export function canTransitionTopicStatus(from: TopicStatus, to: TopicStatus): boolean {
  if (from === to) {
    return false;
  }
  return (ALLOWED_TOPIC_TRANSITIONS[from] as readonly TopicStatus[]).includes(to);
}

export function assertTopicTransition(from: TopicStatus, to: TopicStatus): void {
  if (!canTransitionTopicStatus(from, to)) {
    throw new TopicDomainError(
      "INVALID_STATUS_TRANSITION",
      `Cannot move topic from ${TOPIC_STATUS_LABELS[from]} to ${TOPIC_STATUS_LABELS[to]}.`,
      {
        details: {
          from,
          to,
          allowed: [...ALLOWED_TOPIC_TRANSITIONS[from]],
        },
      },
    );
  }
}

export function transitionEventForStatus(to: TopicStatus): string {
  switch (to) {
    case "approved":
      return "topic_approved";
    case "rejected":
      return "topic_rejected";
    case "archived":
      return "topic_archived";
    case "inbox":
      return "topic_restored";
    case "scheduled":
      return "topic_scheduled";
    case "drafting":
      return "article_draft_created";
    case "published":
      return "topic_published";
    default:
      return "topic_updated";
  }
}
