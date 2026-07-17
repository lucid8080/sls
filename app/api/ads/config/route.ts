import { getDefaultAdSettings, getAdSettings, toPublicAdConfig } from "@/lib/ads/settings";
import { isDatabaseConfigured } from "@/lib/cms/db/client";
import { jsonOk } from "@/lib/cms/http";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonOk(toPublicAdConfig(getDefaultAdSettings()));
  }

  try {
    const settings = await getAdSettings();
    return jsonOk(toPublicAdConfig(settings));
  } catch {
    return jsonOk(toPublicAdConfig(getDefaultAdSettings()));
  }
}
