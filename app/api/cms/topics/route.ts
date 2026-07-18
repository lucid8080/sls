import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import {
  countTopicsByStatus,
  createTopicFromInput,
  listTopics,
} from "@/lib/cms/topics/repository";
import {
  createTopicSchema,
  topicListFiltersSchema,
} from "@/lib/cms/topics/schemas";
import { topicRouteError, validationError } from "@/lib/cms/topics/route-utils";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }
  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = topicListFiltersSchema.safeParse(params);
    if (!parsed.success) {
      throw validationError("Invalid topic filters.");
    }

    const [result, counts] = await Promise.all([
      listTopics(parsed.data),
      countTopicsByStatus(),
    ]);
    return jsonOk({ ...result, counts });
  } catch (error) {
    return topicRouteError(error);
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

  try {
    const body = await readJsonBody<unknown>(request);
    const parsed = createTopicSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid topic input.");
    }
    const topic = await createTopicFromInput(
      parsed.data,
      session.user?.email ?? "admin",
    );
    return jsonOk({ topic }, { status: 201 });
  } catch (error) {
    return topicRouteError(error);
  }
}
