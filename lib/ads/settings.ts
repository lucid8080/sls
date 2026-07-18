import { AD_PLACEMENTS } from "@/lib/ads/placements";
import type { AdPlacementState, AdSettings, PublicAdConfig } from "@/lib/ads/types";
import { getSetting, setSetting } from "@/lib/cms/settings";

const SETTINGS_KEY = "ad_placements";

function defaultPlacementStates(): Record<string, AdPlacementState> {
  return Object.fromEntries(
    AD_PLACEMENTS.map((placement) => [placement.key, { enabled: placement.defaultEnabled }]),
  );
}

export function getDefaultAdSettings(): AdSettings {
  return {
    globalEnabled: true,
    placements: defaultPlacementStates(),
  };
}

function normalizeAdSettings(raw: Partial<AdSettings> | null | undefined): AdSettings {
  const defaults = getDefaultAdSettings();
  if (!raw) {
    return defaults;
  }

  const placements = { ...defaults.placements };
  for (const [key, state] of Object.entries(raw.placements ?? {})) {
    if (placements[key]) {
      placements[key] = { enabled: Boolean(state?.enabled) };
    }
  }

  return {
    globalEnabled: raw.globalEnabled ?? defaults.globalEnabled,
    placements,
  };
}

export async function getAdSettings(): Promise<AdSettings> {
  const stored = await getSetting<Partial<AdSettings> | null>(SETTINGS_KEY, null);
  return normalizeAdSettings(stored);
}

export async function persistAdSettings(settings: AdSettings): Promise<void> {
  await setSetting(SETTINGS_KEY, normalizeAdSettings(settings));
}

export function toPublicAdConfig(settings: AdSettings): PublicAdConfig {
  const placements = Object.fromEntries(
    AD_PLACEMENTS.map((placement) => [
      placement.key,
      settings.globalEnabled && (settings.placements[placement.key]?.enabled ?? placement.defaultEnabled),
    ]),
  );

  const enabledEzoicIds = AD_PLACEMENTS.filter((placement) => placements[placement.key]).map(
    (placement) => placement.ezoicId,
  );
  const disabledEzoicIds = AD_PLACEMENTS.filter((placement) => !placements[placement.key]).map(
    (placement) => placement.ezoicId,
  );

  return {
    globalEnabled: settings.globalEnabled,
    enabledEzoicIds,
    disabledEzoicIds,
    placements,
  };
}

export function isPlacementEnabled(settings: AdSettings, placementKey: string): boolean {
  if (!settings.globalEnabled) {
    return false;
  }
  const placement = AD_PLACEMENTS.find((entry) => entry.key === placementKey);
  if (!placement) {
    return false;
  }
  return settings.placements[placementKey]?.enabled ?? placement.defaultEnabled;
}
