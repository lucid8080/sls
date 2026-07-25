import { AD_PLACEMENTS, AD_PLACEMENT_GROUPS } from "@/lib/ads/placements";
import { saveAdSettings } from "@/lib/ads/server-settings";
import { getAdSettings, getDefaultAdSettings } from "@/lib/ads/settings";
import type { AdSettings } from "@/lib/ads/types";
import { verifyAgentRequest } from "@/lib/cms/agent-auth";
import { agentJsonError, agentJsonOk, readJsonBody } from "@/lib/cms/http";

export async function GET(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:ads");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const settings = await getAdSettings();
  return agentJsonOk({
    settings,
    placements: AD_PLACEMENTS,
    groups: AD_PLACEMENT_GROUPS,
    defaults: getDefaultAdSettings(),
  });
}

export async function POST(request: Request) {
  const authResult = await verifyAgentRequest(request.headers.get("authorization"), "agent:ads");
  if (!authResult.ok) {
    return agentJsonError(authResult.error, authResult.status);
  }

  const body = await readJsonBody<{
    globalEnabled?: boolean;
    placements?: Record<string, { enabled: boolean }>;
    reset?: boolean;
  }>(request);

  if (!body) {
    return agentJsonError("Invalid JSON body.");
  }

  const current = body.reset ? getDefaultAdSettings() : await getAdSettings();
  const next: AdSettings = {
    globalEnabled: body.globalEnabled ?? current.globalEnabled,
    placements: { ...current.placements },
  };

  if (body.placements) {
    for (const [key, state] of Object.entries(body.placements)) {
      if (next.placements[key]) {
        next.placements[key] = { enabled: Boolean(state.enabled) };
      }
    }
  }

  await saveAdSettings(next);
  return agentJsonOk({ ok: true, settings: next });
}
