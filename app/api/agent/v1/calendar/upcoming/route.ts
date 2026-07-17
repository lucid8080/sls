import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { listCalendarEntries } from "@/lib/cms/articles";
import { todayInTimezone, getAutopilotSettings } from "@/lib/cms/autopilot";
import { jsonError, jsonOk } from "@/lib/cms/http";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:calendar");
  if (!authResult.ok) {
    return jsonError(authResult.error, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "14");
  const settings = await getAutopilotSettings();
  const from = todayInTimezone(settings.timezone);
  const entries = await listCalendarEntries(from);
  return jsonOk({ from, entries: entries.slice(0, limit) });
}
