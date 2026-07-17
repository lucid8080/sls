import { runDailyAutopilot } from "@/lib/cms/autopilot";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk } from "@/lib/cms/http";
import { notifyTelegram } from "@/lib/cms/telegram";

export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return jsonError("Unauthorized.", 401);
  }

  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const result = await runDailyAutopilot();

  if (result.jobId) {
    await notifyTelegram(
      `Autopilot job created for ${result.date}\nTopic: ${result.topic}\nJob ID: ${result.jobId}`,
    );
  }

  return jsonOk(result);
}
