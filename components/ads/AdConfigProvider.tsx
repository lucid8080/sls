"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getDefaultAdSettings, toPublicAdConfig } from "@/lib/ads/settings";
import type { PublicAdConfig } from "@/lib/ads/types";

type AdConfigContextValue = {
  config: PublicAdConfig;
  loaded: boolean;
  isEnabled: (placementKey: string) => boolean;
};

const defaultConfig = toPublicAdConfig(getDefaultAdSettings());

const AdConfigContext = createContext<AdConfigContextValue>({
  config: defaultConfig,
  loaded: false,
  isEnabled: (placementKey) => defaultConfig.placements[placementKey] ?? false,
});

type AdConfigProviderProps = {
  children: ReactNode;
  initialConfig?: PublicAdConfig;
};

export function AdConfigProvider({ children, initialConfig }: AdConfigProviderProps) {
  const [config, setConfig] = useState<PublicAdConfig>(initialConfig ?? defaultConfig);
  const [loaded, setLoaded] = useState(Boolean(initialConfig));

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ads/config")
      .then(async (response) => {
        if (!response.ok) {
          return initialConfig ?? defaultConfig;
        }
        return (await response.json()) as PublicAdConfig;
      })
      .then((nextConfig) => {
        if (!cancelled) {
          setConfig(nextConfig);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfig(initialConfig ?? defaultConfig);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialConfig]);

  const value = useMemo<AdConfigContextValue>(
    () => ({
      config,
      loaded,
      isEnabled: (placementKey) => config.placements[placementKey] ?? false,
    }),
    [config, loaded],
  );

  return <AdConfigContext.Provider value={value}>{children}</AdConfigContext.Provider>;
}

export function useAdConfig() {
  return useContext(AdConfigContext);
}
