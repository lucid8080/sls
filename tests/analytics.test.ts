import { describe, expect, it } from "vitest";
import { getGoogleAnalyticsConfig } from "@/lib/analytics";

describe("Google Analytics configuration", () => {
  it("builds the GA4 tag configuration for the site measurement ID", () => {
    const config = getGoogleAnalyticsConfig("G-Y029QN6YPB");

    expect(config.scriptSrc).toBe("https://www.googletagmanager.com/gtag/js?id=G-Y029QN6YPB");
    expect(config.initScript).toContain("gtag('config', 'G-Y029QN6YPB')");
  });

  it("rejects malformed measurement IDs", () => {
    expect(() => getGoogleAnalyticsConfig("UA-153174261-1")).toThrow("Invalid GA4 measurement ID");
    expect(() => getGoogleAnalyticsConfig("G-invalid<script>")).toThrow("Invalid GA4 measurement ID");
  });
});
