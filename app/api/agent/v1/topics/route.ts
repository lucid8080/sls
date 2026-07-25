import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { agentJsonError, agentJsonOk, readJsonBody, withAgentCors } from "@/lib/cms/http";
import {
  countTopicsByStatus,
  createTopicFromInput,
  listTopics,
} from "@/lib/cms/topics/repository";
import { topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { createTopicSchema, topicListFiltersSchema } from "@/lib/cms/topics/schemas";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:topics");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = topicListFiltersSchema.safeParse(params);
    if (!parsed.success) {
      throw validationError("Invalid topic filters.");
    }

    const [result, counts] = await Promise.all([listTopics(parsed.data), countTopicsByStatus()]);
    return agentJsonOk({ ...result, counts });
  } catch (error) {
    return withAgentCors(topicRouteError(error));
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:topics");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  try {
    const body = await readJsonBody<unknown>(request);
    const parsed = createTopicSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid topic input.");
    }
    const topic = await createTopicFromInput(parsed.data, `agent:${authResult.label}`);
    return agentJsonOk({ topic }, { status: 201 });
  } catch (error) {
    return withAgentCors(topicRouteError(error));
  }
}
