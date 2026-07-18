import { AD_PLACEMENTS, AD_PLACEMENT_GROUPS } from "@/lib/ads/placements";
import { saveAdSettings } from "@/lib/ads/server-settings";
import { getAdSettings, getDefaultAdSettings } from "@/lib/ads/settings";
import type { AdSettings } from "@/lib/ads/types";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/cms/http";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_URL is not configured.", 503);
  }

  const session = await auth();
  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  const settings = await getAdSettings();
  return jsonOk({
    settings,
    placements: AD_PLACEMENTS,
    groups: AD_PLACEMENT_GROUPS,
    defaults: getDefaultAdSettings(),
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
    globalEnabled?: boolean;
    placements?: Record<string, { enabled: boolean }>;
    reset?: boolean;
  }>(request);

  if (!body) {
    return jsonError("Invalid JSON body.");
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
  return jsonOk({ ok: true, settings: next });
}
