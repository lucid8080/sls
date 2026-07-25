import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import {
  deleteAffiliateLink,
  getAffiliateLinkById,
  updateAffiliateLink,
} from "@/lib/cms/affiliate-links";
import { agentJsonError, agentJsonOk, readJsonBody } from "@/lib/cms/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(
    request.headers.get("authorization"),
    "agent:affiliates",
  );
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;
  const link = await getAffiliateLinkById(id);
  if (!link) {
    return agentJsonError("Affiliate link not found.", 404);
  }

  return agentJsonOk({ link });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(
    request.headers.get("authorization"),
    "agent:affiliates",
  );
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;
  const body = await readJsonBody<{
    url?: string;
    label?: string | null;
    notes?: string | null;
  }>(request);

  if (!body) {
    return agentJsonError("Invalid JSON body.");
  }

  try {
    const link = await updateAffiliateLink(id, body);
    return agentJsonOk({ link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update affiliate link.";
    if (message === "Affiliate link not found.") {
      return agentJsonError(message, 404);
    }
    return agentJsonError(message);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(
    request.headers.get("authorization"),
    "agent:affiliates",
  );
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { id } = await context.params;

  try {
    await deleteAffiliateLink(id);
    return agentJsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete affiliate link.";
    if (message === "Affiliate link not found.") {
      return agentJsonError(message, 404);
    }
    return agentJsonError(message);
  }
}
