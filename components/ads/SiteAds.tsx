"use client";

import type { ReactNode } from "react";
import { AdConfigProvider } from "@/components/ads/AdConfigProvider";
import { EzoicShowAds } from "@/components/ads/EzoicScripts";
import type { PublicAdConfig } from "@/lib/ads/types";

export function SiteAds({
  children,
  initialConfig,
}: {
  children: ReactNode;
  initialConfig?: PublicAdConfig;
}) {
  return (
    <AdConfigProvider initialConfig={initialConfig}>
      {children}
      <EzoicShowAds />
    </AdConfigProvider>
  );
}
