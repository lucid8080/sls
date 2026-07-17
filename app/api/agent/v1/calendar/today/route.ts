import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { getCalendarEntryByDate } from "@/lib/cms/articles";
import { todayInTimezone, getAutopilotSettings } from "@/lib/cms/autopilot";
import { jsonError, jsonOk } from "@/lib/cms/http";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:calendar");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const settings = await getAutopilotSettings();
  const date = todayInTimezone(settings.timezone);
  const entry = await getCalendarEntryByDate(date);

  return jsonOk({
    date,
    timezone: settings.timezone,
    entry: entry ?? null,
  });
}
