import { revalidateTag, unstable_cache } from "next/cache";
import type { AdSettings } from "@/lib/ads/types";
import {
  getAdSettings,
  getDefaultAdSettings,
  persistAdSettings,
} from "@/lib/ads/settings";
import { isDatabaseConfigured } from "@/lib/cms/db/client";

export const AD_SETTINGS_CACHE_TAG = "public-ad-settings";

const getCachedAdSettings = unstable_cache(
  async () => getAdSettings(),
  ["public-ad-settings"],
  {
    revalidate: false,
    tags: [AD_SETTINGS_CACHE_TAG],
  },
);

/** Safe for public pages — never throws when DATABASE_URL is missing. */
export async function getAdSettingsSafe(): Promise<AdSettings> {
  if (!isDatabaseConfigured()) {
    return getDefaultAdSettings();
  }

  try {
    return await getCachedAdSettings();
  } catch {
    return getDefaultAdSettings();
  }
}

export async function saveAdSettings(settings: AdSettings): Promise<void> {
  await persistAdSettings(settings);
  revalidateTag(AD_SETTINGS_CACHE_TAG, { expire: 0 });
}
