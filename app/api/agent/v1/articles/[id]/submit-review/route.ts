import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { jsonError, jsonOk } from "@/lib/cms/http";
import { submitForReview } from "@/lib/cms/publish";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:write");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;
  const result = await submitForReview(id, `agent:${authResult.label}`);
  if (!result.ok) {
    return jsonError(result.error ?? "Failed to submit for review.", 400);
  }

  return jsonOk(result);
}
