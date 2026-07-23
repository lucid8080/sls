import { auth } from "@/lib/auth";
import {
  BULK_DELETE_MEDIA_MAX_IDS,
  bulkDeleteAdminMedia,
} from "@/lib/cms/media-delete";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { decodeMediaId } from "@/lib/cms/media-paths";

type BulkBody = {
  action?: string;
  ids?: unknown;
};

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await readJsonBody<BulkBody>(request);
  if (!body || body.action !== "delete") {
    return jsonError('action must be "delete".');
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonError("ids must be a non-empty array of media ids.");
  }

  if (body.ids.length > BULK_DELETE_MEDIA_MAX_IDS) {
    return jsonError(`ids cannot exceed ${BULK_DELETE_MEDIA_MAX_IDS} items.`);
  }

  if (!body.ids.every((id): id is string => typeof id === "string" && id.length > 0)) {
    return jsonError("ids must be a non-empty array of media ids.");
  }

  const decodedIds = body.ids.map((id) => decodeMediaId(id));
  const result = await bulkDeleteAdminMedia(decodedIds, session.user?.email ?? "admin");

  return jsonOk({ result });
}
