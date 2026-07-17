import { describe, expect, it } from "vitest";
import { injectInContentAds } from "@/lib/ads/in-content";
import { getDefaultAdSettings } from "@/lib/ads/settings";

describe("ad in-content injection", () => {
  it("inserts placeholders after configured paragraphs", () => {
    const html = "<p>One</p><p>Two</p><p>Three</p><p>Four</p>";
    const result = injectInContentAds(html);

    expect(result).toContain('id="ezoic-pub-ad-placeholder-145"');
    expect(result).toContain('id="ezoic-pub-ad-placeholder-153"');
    expect(result.indexOf("ezoic-pub-ad-placeholder-145")).toBeLessThan(result.indexOf("ezoic-pub-ad-placeholder-153"));
  });

  it("skips disabled placements when settings are provided", () => {
    const settings = getDefaultAdSettings();
    settings.placements.under_page_title = { enabled: false };

    const html = "<p>One</p><p>Two</p>";
    const result = injectInContentAds(html, settings);

    expect(result).not.toContain('id="ezoic-pub-ad-placeholder-145"');
  });

  it("skips all placements when ads are globally disabled", () => {
    const settings = getDefaultAdSettings();
    settings.globalEnabled = false;

    const html = "<p>One</p><p>Two</p><p>Three</p>";
    const result = injectInContentAds(html, settings);

    expect(result).not.toContain("ezoic-pub-ad-placeholder");
  });
});
