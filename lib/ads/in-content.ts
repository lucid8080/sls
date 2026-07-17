import { getInContentPlacements } from "@/lib/ads/placements";
import type { AdSettings } from "@/lib/ads/types";
import { isPlacementEnabled } from "@/lib/ads/settings";

const PARAGRAPH_SPLIT = /(<p\b[^>]*>[\s\S]*?<\/p>)/gi;

export function splitHtmlParagraphs(html: string): string[] {
  const parts = html.split(PARAGRAPH_SPLIT).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [html];
  }
  return parts;
}

export function buildInContentAdMarker(placementKey: string, ezoicId: number): string {
  return `<!--ezoic:${placementKey}--><div id="ezoic-pub-ad-placeholder-${ezoicId}" data-ezoic-placement="${placementKey}" data-inserter-version="1"></div><!--/ezoic:${placementKey}-->`;
}

export function injectInContentAds(html: string, settings?: AdSettings): string {
  const rules = getInContentPlacements();
  const parts = splitHtmlParagraphs(html);
  let paragraphCount = 0;
  const output: string[] = [];

  for (const part of parts) {
    output.push(part);
    if (!/^<p\b/i.test(part)) {
      continue;
    }

    paragraphCount += 1;
    const matches = rules.filter((rule) => rule.afterParagraph === paragraphCount);
    for (const rule of matches) {
      if (settings && !isPlacementEnabled(settings, rule.key)) {
        continue;
      }
      output.push(buildInContentAdMarker(rule.key, rule.ezoicId));
    }
  }

  return output.join("");
}
