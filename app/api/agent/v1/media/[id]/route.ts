import { getAdminMediaById, updateAdminMediaAlt } from "@/lib/cms/admin-media";
import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { agentJsonError, agentJsonOk, readJsonBody } from "@/lib/cms/http";
import { deleteAdminMedia } from "@/lib/cms/media-delete";
import { decodeMediaId } from "@/lib/cms/media-paths";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:media");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { id: rawId } = await context.params;
  const media = await getAdminMediaById(decodeMediaId(rawId));
  if (!media) {
    return agentJsonError("Media not found.", 404);
  }

  return agentJsonOk({ media });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:media");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { id: rawId } = await context.params;
  const id = decodeMediaId(rawId);
  if (id.startsWith("recovered:")) {
    return agentJsonError("Recovered media alt text cannot be edited.", 403);
  }

  const body = await readJsonBody<{ alt?: string }>(request);
  if (!body || typeof body.alt !== "string") {
    return agentJsonError("alt is required.");
  }

  const media = await updateAdminMediaAlt(id, body.alt);
  if (!media) {
    return agentJsonError("Media not found.", 404);
  }

  return agentJsonOk({ media });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:media");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const { id: rawId } = await context.params;
  const result = await deleteAdminMedia(decodeMediaId(rawId), `agent:${authResult.label}`);

  if (!result.ok) {
    if (result.status === 409) {
      return agentJsonError("Media is still referenced by articles.", 409, {
        usages: result.usages,
      });
    }
    return agentJsonError(result.message, result.status);
  }

  return agentJsonOk({ deleted: true });
}
