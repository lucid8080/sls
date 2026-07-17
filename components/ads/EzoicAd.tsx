"use client";

import { getPlacementByKey } from "@/lib/ads/placements";
import { useAdConfig } from "@/components/ads/AdConfigProvider";

type EzoicAdProps = {
  placementKey: string;
  className?: string;
};

export function EzoicAd({ placementKey, className }: EzoicAdProps) {
  const { isEnabled, loaded, config } = useAdConfig();
  const placement = getPlacementByKey(placementKey);

  if (!placement) {
    return null;
  }

  // Wait for config so we never mount a placeholder that should stay off.
  if (!loaded) {
    return null;
  }

  if (!config.globalEnabled || !isEnabled(placementKey)) {
    return null;
  }

  return (
    <div className={className ? `ezoic-ad-slot ${className}` : "ezoic-ad-slot"}>
      <span className="ezoic-ad-label">Advertisement</span>
      <div
        id={`ezoic-pub-ad-placeholder-${placement.ezoicId}`}
        data-ezoic-placement={placement.key}
        data-inserter-version="1"
      />
    </div>
  );
}
