import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { getAgentJob } from "@/lib/cms/articles";
import { jsonError, jsonOk, headWithJsonBody } from "@/lib/cms/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:read");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;
  const job = await getAgentJob(id);
  if (!job) {
    return jsonError("Job not found.", 404);
  }

  return jsonOk({ job });
}

export async function HEAD(request: Request, context: RouteContext) {
  return headWithJsonBody(await GET(request, context));
}
