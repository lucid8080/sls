import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { agentJsonError, agentJsonOk, readJsonBody, withAgentCors } from "@/lib/cms/http";
import { transitionTopicStatus } from "@/lib/cms/topics/repository";
import { topicIdSchema, topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { topicStatusChangeSchema } from "@/lib/cms/topics/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:topics");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  try {
    const { id } = await context.params;
    if (!topicIdSchema.safeParse(id).success) {
      throw validationError("Invalid topic ID.");
    }
    const body = await readJsonBody<unknown>(request);
    const parsed = topicStatusChangeSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid status change.");
    }
    if (parsed.data.toStatus === "rejected" && !parsed.data.rejectionReason?.trim()) {
      throw validationError("A rejection reason is required.");
    }
    const topic = await transitionTopicStatus(id, parsed.data.toStatus, {
      actorId: `agent:${authResult.label}`,
      rejectionReason: parsed.data.rejectionReason,
      metadata: parsed.data.notes ? { notes: parsed.data.notes } : undefined,
    });
    return agentJsonOk({ topic });
  } catch (error) {
    return withAgentCors(topicRouteError(error));
  }
}
