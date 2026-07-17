import Script from "next/script";

/**
 * Privacy + Ezoic header scripts for the public site.
 * Loaded as early as practical within the site layout (afterInteractive /
 * worker strategies). `showAds()` is handled separately by `EzoicShowAds`.
 */
export function EzoicHeadScripts() {
  return (
    <>
      <Script
        id="ezoic-privacy-cmp"
        src="https://cmp.gatekeeperconsent.com/min.js"
        strategy="afterInteractive"
        data-cfasync="false"
      />
      <Script
        id="ezoic-privacy-gatekeeper"
        src="https://the.gatekeeperconsent.com/cmp.min.js"
        strategy="afterInteractive"
        data-cfasync="false"
      />
      <Script id="ezoic-standalone-init" strategy="afterInteractive">
        {`window.ezstandalone = window.ezstandalone || {}; window.ezstandalone.cmd = window.ezstandalone.cmd || [];`}
      </Script>
      <Script src="https://www.ezojs.com/ezoic/sa.min.js" strategy="afterInteractive" async />
      <Script src="https://ezoicanalytics.com/analytics.js" strategy="afterInteractive" />
    </>
  );
}
