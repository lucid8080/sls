import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import {
  createManualAffiliateLink,
  listAffiliateLinks,
  type AffiliateLinkFilters,
} from "@/lib/cms/affiliate-links";
import { agentJsonError, agentJsonOk, readJsonBody } from "@/lib/cms/http";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(
    request.headers.get("authorization"),
    "agent:affiliates",
  );
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const filters: AffiliateLinkFilters = {
    network: (searchParams.get("network") as AffiliateLinkFilters["network"]) || undefined,
    tagStatus: (searchParams.get("tagStatus") as AffiliateLinkFilters["tagStatus"]) || undefined,
    liveStatus: (searchParams.get("liveStatus") as AffiliateLinkFilters["liveStatus"]) || undefined,
    search: searchParams.get("search") || undefined,
  };

  try {
    const links = await listAffiliateLinks(filters);
    return agentJsonOk({ links, count: links.length });
  } catch (error) {
    return agentJsonError(
      error instanceof Error ? error.message : "Failed to list affiliate links.",
      500,
    );
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAgentRequest(
    request.headers.get("authorization"),
    "agent:affiliates",
  );
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const body = await readJsonBody<{
    url: string;
    label?: string | null;
    notes?: string | null;
  }>(request);

  if (!body?.url?.trim()) {
    return agentJsonError("url is required.");
  }

  try {
    const link = await createManualAffiliateLink(body);
    return agentJsonOk({ link }, { status: 201 });
  } catch (error) {
    return agentJsonError(
      error instanceof Error ? error.message : "Failed to create affiliate link.",
    );
  }
}
