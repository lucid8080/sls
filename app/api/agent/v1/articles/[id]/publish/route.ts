import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { jsonError, jsonOk } from "@/lib/cms/http";
import { publishArticle } from "@/lib/cms/publish";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:publish");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;
  const result = await publishArticle(id, `agent:${authResult.label}`);
  if (!result.ok) {
    return jsonError(result.error ?? "Publish failed.", 422);
  }

  return jsonOk(result);
}
