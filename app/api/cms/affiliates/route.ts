import { auth } from "@/lib/auth";
import {
  createManualAffiliateLink,
  listAffiliateLinks,
  type AffiliateLinkFilters,
} from "@/lib/cms/affiliate-links";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
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
    return jsonOk({ links, count: links.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to list affiliate links.", 500);
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await readJsonBody<{
    url: string;
    label?: string | null;
    notes?: string | null;
  }>(request);

  if (!body?.url?.trim()) {
    return jsonError("url is required.");
  }

  try {
    const link = await createManualAffiliateLink(body);
    return jsonOk({ link }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create affiliate link.";
    return jsonError(message, 400);
  }
}
