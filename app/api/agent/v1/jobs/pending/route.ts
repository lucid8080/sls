import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { listPendingAgentJobs } from "@/lib/cms/articles";
import { jsonError, jsonOk, headWithJsonBody } from "@/lib/cms/http";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:read");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const jobs = await listPendingAgentJobs(20);
  return jsonOk({ jobs });
}

export async function HEAD(request: Request) {
  return headWithJsonBody(await GET(request));
}
