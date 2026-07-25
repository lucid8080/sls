import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { agentJsonError, agentJsonOk, readJsonBody, withAgentCors } from "@/lib/cms/http";
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

async function validTopicId(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  if (!topicIdSchema.safeParse(id).success) {
    throw validationError("Invalid topic ID.");
  }
  return id;
}

export async function GET(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:topics");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  try {
    const id = await validTopicId(context);
    const topic = await getTopicWithSources(id);
    if (!topic) {
      throw new TopicDomainError("NOT_FOUND", "Topic not found.");
    }

    const activity = await listTopicActivity({ topicId: id });
    return agentJsonOk({ topic, activity });
  } catch (error) {
    return withAgentCors(topicRouteError(error));
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:topics");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  try {
    const id = await validTopicId(context);
    const body = await readJsonBody<unknown>(request);
    const parsed = updateTopicSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid topic update.");
    }
    const topic = await updateTopicById(id, parsed.data, `agent:${authResult.label}`);
    return agentJsonOk({ topic });
  } catch (error) {
    return withAgentCors(topicRouteError(error));
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:topics");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  try {
    const id = await validTopicId(context);
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
    return agentJsonOk({ deleted: true });
  } catch (error) {
    return withAgentCors(topicRouteError(error));
  }
}
