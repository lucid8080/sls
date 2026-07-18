import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { transitionTopicStatus } from "@/lib/cms/topics/repository";
import { topicIdSchema, topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { topicStatusChangeSchema } from "@/lib/cms/topics/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }
  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const { id } = await context.params;
    if (!topicIdSchema.safeParse(id).success) {
      throw validationError("Invalid topic ID.");
    }
    const body = await readJsonBody<unknown>(request);
    const parsed = topicStatusChangeSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid status change.");
    }
    if (parsed.data.toStatus === "rejected" && !parsed.data.rejectionReason?.trim()) {
      throw validationError("A rejection reason is required.");
    }
    const topic = await transitionTopicStatus(id, parsed.data.toStatus, {
      actorId: session.user?.email ?? "admin",
      rejectionReason: parsed.data.rejectionReason,
      metadata: parsed.data.notes ? { notes: parsed.data.notes } : undefined,
    });
    return jsonOk({ topic });
  } catch (error) {
    return topicRouteError(error);
  }
}
