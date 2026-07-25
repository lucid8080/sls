import { auth } from "@/lib/auth";
import { getAutopilotSettings, setAutopilotSetting } from "@/lib/cms/autopilot";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { getSetting, setSetting } from "@/lib/cms/settings";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const autopilot = await getAutopilotSettings();
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

  return jsonOk({
    autopilot,
    telegramConfigured,
    defaultAuthor: await getSetting("default_author", null),
  });
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
    autopilotEnabled?: boolean;
    autopilotAutoPublish?: boolean;
    autopilotTimezone?: string;
    defaultAuthor?: Record<string, unknown> | null;
  }>(request);

  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  if (body.autopilotEnabled !== undefined) {
    await setAutopilotSetting("autopilot_enabled", body.autopilotEnabled);
  }
  if (body.autopilotAutoPublish !== undefined) {
    await setAutopilotSetting("autopilot_auto_publish", body.autopilotAutoPublish);
  }
  if (body.autopilotTimezone) {
    await setAutopilotSetting("autopilot_timezone", body.autopilotTimezone);
  }
  if (body.defaultAuthor !== undefined) {
    await setSetting("default_author", body.defaultAuthor);
  }

  return jsonOk({ ok: true });
}
