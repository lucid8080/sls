import Script from "next/script";
import { DEFAULT_GA4_MEASUREMENT_ID, getGoogleAnalyticsConfig } from "@/lib/analytics";

export function GoogleAnalytics() {
  const measurementId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || DEFAULT_GA4_MEASUREMENT_ID;
  const config = getGoogleAnalyticsConfig(measurementId);

  return (
    <>
      <Script src={config.scriptSrc} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {config.initScript}
      </Script>
    </>
  );
}
