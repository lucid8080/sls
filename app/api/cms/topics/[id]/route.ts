import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { listTopicActivity } from "@/lib/cms/topics/activity-service";
import { TopicDomainError } from "@/lib/cms/topics/errors";
import {
  deleteTopicById,
  getTopicById,
  getTopicWithSources,
  updateTopicById,
} from "@/lib/cms/topics/repository";
import { topicIdSchema, topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { updateTopicSchema } from "@/lib/cms/topics/schemas";

type RouteContext = { params: Promise<{ id: string }> };

async function authorizedId(context: RouteContext) {
  const session = await auth();
  if (!session) {
    throw new TopicDomainError("AUTH_REQUIRED", "Unauthorized.");
  }
  const { id } = await context.params;
  if (!topicIdSchema.safeParse(id).success) {
    throw validationError("Invalid topic ID.");
  }
  return { id, actorId: session.user?.email ?? "admin" };
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }
  try {
    const { id } = await authorizedId(context);
    const topic = await getTopicWithSources(id);
    if (!topic) {
      throw new TopicDomainError("NOT_FOUND", "Topic not found.");
    }
    const [topicEntries, sourceEntries] = await Promise.all([
      listTopicActivity({ topicId: id }),
      topic.primarySourceId
        ? listTopicActivity({ sourceId: topic.primarySourceId })
        : Promise.resolve([]),
    ]);
    const activity = [...new Map(
      [...topicEntries, ...sourceEntries].map((entry) => [entry.id, entry]),
    ).values()].sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf());
    return jsonOk({ topic, activity });
  } catch (error) {
    return topicRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }
  try {
    const { id, actorId } = await authorizedId(context);
    const body = await readJsonBody<unknown>(request);
    const parsed = updateTopicSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid topic update.");
    }
    const topic = await updateTopicById(id, parsed.data, actorId);
    return jsonOk({ topic });
  } catch (error) {
    return topicRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }
  try {
    const { id } = await authorizedId(context);
    const topic = await getTopicById(id);
    if (!topic) {
      throw new TopicDomainError("NOT_FOUND", "Topic not found.");
    }
    if (topic.articleId || topic.calendarEntryId) {
      throw new TopicDomainError(
        "VALIDATION_ERROR",
        "Topics linked to an article or calendar entry cannot be deleted. Archive it instead.",
      );
    }
    await deleteTopicById(id);
    return jsonOk({ deleted: true });
  } catch (error) {
    return topicRouteError(error);
  }
}
