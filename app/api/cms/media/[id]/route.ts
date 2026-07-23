import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminMediaById, updateAdminMediaAlt } from "@/lib/cms/admin-media";
import { deleteAdminMedia } from "@/lib/cms/media-delete";
import { decodeMediaId } from "@/lib/cms/media-paths";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";

type RouteContext = { params: Promise<{ id: string }> };

async function authorizedSession() {
  const session = await auth();
  if (!session) {
    return null;
  }
  return session;
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await authorizedSession();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id: rawId } = await context.params;
  const media = await getAdminMediaById(decodeMediaId(rawId));
  if (!media) {
    return jsonError("Media not found.", 404);
  }

  return jsonOk({ media });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await authorizedSession();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id: rawId } = await context.params;
  const id = decodeMediaId(rawId);
  if (id.startsWith("recovered:")) {
    return jsonError("Recovered media alt text cannot be edited.", 403);
  }

  const body = await readJsonBody<{ alt?: string }>(request);
  if (!body || typeof body.alt !== "string") {
    return jsonError("alt is required.");
  }

  const media = await updateAdminMediaAlt(id, body.alt);
  if (!media) {
    return jsonError("Media not found.", 404);
  }

  return jsonOk({ media });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await authorizedSession();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const { id: rawId } = await context.params;
  const result = await deleteAdminMedia(decodeMediaId(rawId), session.user?.email ?? "admin");

  if (!result.ok) {
    if (result.status === 409) {
      return NextResponse.json(
        {
          error: "Media is still referenced by articles.",
          usages: result.usages,
        },
        { status: 409 },
      );
    }
    return jsonError(result.message, result.status);
  }

  return jsonOk({ deleted: true });
}
