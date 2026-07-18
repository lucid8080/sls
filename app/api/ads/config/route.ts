import { getAdSettingsSafe } from "@/lib/ads/server-settings";
import { getDefaultAdSettings, toPublicAdConfig } from "@/lib/ads/settings";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonOk } from "@/lib/cms/http";

export const dynamic = "force-static";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonOk(toPublicAdConfig(getDefaultAdSettings()));
  }

  const settings = await getAdSettingsSafe();
  return jsonOk(toPublicAdConfig(settings));
}
