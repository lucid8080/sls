import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { agentJsonError, agentJsonOk, headWithJsonBody } from "@/lib/cms/http";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:read");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  return agentJsonOk({
    ok: true,
    api: "sls-agent",
    version: "v1",
    keyLabel: authResult.label,
    scopes: authResult.scopes,
    endpoints: {
      articles: "/api/agent/v1/articles",
      media: "/api/agent/v1/media",
      calendarToday: "/api/agent/v1/calendar/today",
      calendarUpcoming: "/api/agent/v1/calendar/upcoming",
      searchInternal: "/api/agent/v1/search/internal",
      jobsPending: "/api/agent/v1/jobs/pending",
      ads: "/api/agent/v1/ads",
      affiliates: "/api/agent/v1/affiliates",
      topics: "/api/agent/v1/topics",
    },
  });
}

export async function HEAD(request: Request) {
  return headWithJsonBody(await GET(request));
}

export async function OPTIONS() {
  return agentJsonOk({
    ok: true,
    api: "sls-agent",
    version: "v1",
    methods: ["GET", "HEAD", "OPTIONS"],
    note: "Use GET with Authorization: Bearer <key> for connection tests.",
  });
}
