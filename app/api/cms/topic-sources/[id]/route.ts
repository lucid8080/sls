import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { TopicDomainError } from "@/lib/cms/topics/errors";
import { getTopicSourceById } from "@/lib/cms/topics/repository";
import { topicIdSchema, topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { updateTopicSourceSchema } from "@/lib/cms/topics/schemas";
import { updateTopicSourceDetails } from "@/lib/cms/topics/source-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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
      throw validationError("Invalid source ID.");
    }
    const source = await getTopicSourceById(id);
    if (!source) {
      throw new TopicDomainError("NOT_FOUND", "Topic Source not found.");
    }
    return jsonOk({ source });
  } catch (error) {
    return topicRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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
      throw validationError("Invalid source ID.");
    }
    const body = await readJsonBody<unknown>(request);
    const parsed = updateTopicSourceSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid source update.");
    }
    const source = await updateTopicSourceDetails(
      id,
      parsed.data,
      session.user?.email ?? "admin",
    );
    return jsonOk({ source });
  } catch (error) {
    return topicRouteError(error);
  }
}
