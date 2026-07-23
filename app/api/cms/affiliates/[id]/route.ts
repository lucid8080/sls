import { auth } from "@/lib/auth";
import {
  deleteAffiliateLink,
  getAffiliateLinkById,
  updateAffiliateLink,
} from "@/lib/cms/affiliate-links";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const link = await getAffiliateLinkById(id);
  if (!link) {
    return jsonError("Affiliate link not found.", 404);
  }

  return jsonOk({ link });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const body = await readJsonBody<{
    url?: string;
    label?: string | null;
    notes?: string | null;
  }>(request);

  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  try {
    const link = await updateAffiliateLink(id, body);
    return jsonOk({ link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update affiliate link.";
    if (message === "Affiliate link not found.") {
      return jsonError(message, 404);
    }
    return jsonError(message, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;

  try {
    await deleteAffiliateLink(id);
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete affiliate link.";
    if (message === "Affiliate link not found.") {
      return jsonError(message, 404);
    }
    return jsonError(message, 400);
  }
}
