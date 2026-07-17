"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAdConfig } from "@/components/ads/AdConfigProvider";

declare global {
  interface Window {
    ezstandalone?: {
      cmd: Array<() => void>;
      showAds: (...ids: number[]) => void;
      destroyPlaceholders: (...ids: number[]) => void;
      destroyAll: () => void;
    };
  }
}

function ensureEzoicQueue() {
  window.ezstandalone = window.ezstandalone || {
    cmd: [],
    showAds: () => undefined,
    destroyPlaceholders: () => undefined,
    destroyAll: () => undefined,
  };
  window.ezstandalone.cmd = window.ezstandalone.cmd || [];
}

function runEzoicCommand(callback: () => void) {
  ensureEzoicQueue();
  window.ezstandalone!.cmd.push(callback);
}

function collectPlaceholderIds(): number[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[id^='ezoic-pub-ad-placeholder-']"))
    .map((element) => Number(element.id.replace("ezoic-pub-ad-placeholder-", "")))
    .filter((id) => Number.isFinite(id));
}

function removeDisabledPlaceholders(disabledIds: number[]) {
  for (const id of disabledIds) {
    document.querySelector(`#ezoic-pub-ad-placeholder-${id}`)?.remove();
  }
}

/**
 * Handles SPA route changes for Ezoic: destroy previous slots, then fill
 * placeholders present on the new page.
 */
export function EzoicShowAds() {
  const pathname = usePathname();
  const { config, loaded } = useAdConfig();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    if (!config.globalEnabled) {
      runEzoicCommand(() => {
        window.ezstandalone?.destroyAll?.();
      });
      return;
    }

    const isRouteChange = previousPathname.current !== null && previousPathname.current !== pathname;
    previousPathname.current = pathname;

    const timer = window.setTimeout(() => {
      removeDisabledPlaceholders(config.disabledEzoicIds);

      runEzoicCommand(() => {
        if (isRouteChange && typeof window.ezstandalone?.destroyAll === "function") {
          window.ezstandalone.destroyAll();
        } else if (config.disabledEzoicIds.length > 0) {
          window.ezstandalone?.destroyPlaceholders(...config.disabledEzoicIds);
        }

        const idsOnPage = collectPlaceholderIds().filter((id) => config.enabledEzoicIds.includes(id));
        if (idsOnPage.length > 0) {
          window.ezstandalone?.showAds(...idsOnPage);
        } else {
          window.ezstandalone?.showAds();
        }
      });
    }, 75);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, config, loaded]);

  return null;
}
