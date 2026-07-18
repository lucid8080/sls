import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cachedRead: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  revalidateTag: vi.fn(),
  setSetting: vi.fn(),
  unstableCache: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (
    reader: () => Promise<unknown>,
    keys: string[],
    options: { revalidate: number; tags: string[] },
  ) => {
    mocks.unstableCache(reader, keys, options);
    return mocks.cachedRead;
  },
}));

vi.mock("@/lib/cms/db/client", () => ({
  isDatabaseConfigured: mocks.isDatabaseConfigured,
}));

vi.mock("@/lib/cms/settings", () => ({
  getSetting: vi.fn(),
  setSetting: mocks.setSetting,
}));

import {
  AD_SETTINGS_CACHE_TAG,
  getAdSettingsSafe,
  saveAdSettings,
} from "@/lib/ads/server-settings";
import { getDefaultAdSettings } from "@/lib/ads/settings";

describe("public ad settings cache", () => {
  beforeEach(() => {
    mocks.cachedRead.mockReset();
    mocks.isDatabaseConfigured.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.setSetting.mockReset();
    mocks.isDatabaseConfigured.mockReturnValue(true);
  });

  it("defines one tagged cache that only expires when settings change", () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["public-ad-settings"],
      {
        revalidate: false,
        tags: [AD_SETTINGS_CACHE_TAG],
      },
    );
  });

  it("uses the shared cache for public settings reads", async () => {
    const settings = getDefaultAdSettings();
    settings.globalEnabled = false;
    mocks.cachedRead.mockResolvedValue(settings);

    await expect(getAdSettingsSafe()).resolves.toEqual(settings);
    expect(mocks.cachedRead).toHaveBeenCalledOnce();
  });

  it("does not touch the cache without a configured database", async () => {
    mocks.isDatabaseConfigured.mockReturnValue(false);

    await expect(getAdSettingsSafe()).resolves.toEqual(getDefaultAdSettings());
    expect(mocks.cachedRead).not.toHaveBeenCalled();
  });

  it("falls back to defaults when the cached database read fails", async () => {
    mocks.cachedRead.mockRejectedValue(new Error("database unavailable"));

    await expect(getAdSettingsSafe()).resolves.toEqual(getDefaultAdSettings());
  });

  it("immediately expires the public cache after saving", async () => {
    const settings = getDefaultAdSettings();
    settings.globalEnabled = false;

    await saveAdSettings(settings);

    expect(mocks.setSetting).toHaveBeenCalledWith("ad_placements", settings);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(AD_SETTINGS_CACHE_TAG, { expire: 0 });
  });
});
