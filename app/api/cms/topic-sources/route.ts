import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import { TOPIC_SOURCE_FETCH_STATUSES } from "@/lib/cms/topics/constants";
import { topicRouteError, validationError } from "@/lib/cms/topics/route-utils";
import { createTopicSourceSchema } from "@/lib/cms/topics/schemas";
import {
  createManualSourceWithTopic,
  createUrlSourceWithTopic,
  listTopicSources,
} from "@/lib/cms/topics/source-service";
import type { TopicSourceFetchStatus } from "@/lib/cms/topics/types";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }
  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? 1);
    const pageSize = Number(searchParams.get("pageSize") ?? 25);
    const status = searchParams.get("fetchStatus");
    if (
      status &&
      !TOPIC_SOURCE_FETCH_STATUSES.includes(
        status as (typeof TOPIC_SOURCE_FETCH_STATUSES)[number],
      )
    ) {
      throw validationError("Invalid fetch status.");
    }
    const result = await listTopicSources({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
      fetchStatus: (status || undefined) as TopicSourceFetchStatus | undefined,
    });
    return jsonOk(result);
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
    const parsed = createTopicSourceSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid source input.");
    }
    const actorId = session.user?.email ?? "admin";
    const result =
      "sourceUrl" in parsed.data
        ? await createUrlSourceWithTopic(parsed.data, actorId)
        : await createManualSourceWithTopic(parsed.data, actorId);
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return topicRouteError(error);
  }
}
