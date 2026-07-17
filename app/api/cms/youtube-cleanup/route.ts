import { z } from "zod";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";
import {
  removeRecoveredYouTubeEmbeds,
  scanRecoveredYouTubeEmbeds,
} from "@/lib/cms/recovered-youtube";

export const maxDuration = 60;

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("scan") }),
  z.object({
    action: z.literal("remove"),
    videoIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).min(1).max(200),
  }),
]);

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return jsonError(
      "DATABASE_URL is not configured. Recovered-content removals need the CMS database.",
      503,
    );
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const parsed = requestSchema.safeParse(await readJsonBody<unknown>(request));
  if (!parsed.success) {
    return jsonError("Invalid YouTube cleanup request.");
  }

  try {
    if (parsed.data.action === "scan") {
      return jsonOk({ scan: await scanRecoveredYouTubeEmbeds() });
    }

    const result = await removeRecoveredYouTubeEmbeds(
      parsed.data.videoIds,
      session.user?.email ?? "admin",
    );
    return jsonOk({ result });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown server error.";
    console.error("[youtube-cleanup] Request failed.", error);
    return jsonError(`YouTube cleanup failed: ${detail}`, 500);
  }
}
