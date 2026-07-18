import Script from "next/script";

/**
 * Privacy + Ezoic header scripts for the public site.
 * Gatekeeper must load before any tracking or advertising code. `showAds()`
 * is handled separately by `EzoicShowAds`.
 */
export function EzoicHeadScripts({ adsEnabled }: Readonly<{ adsEnabled: boolean }>) {
  return (
    <>
      <Script
        id="ezoic-privacy-cmp"
        src="https://cmp.gatekeeperconsent.com/min.js"
        strategy="beforeInteractive"
        data-cfasync="false"
      />
      <Script
        id="ezoic-privacy-gatekeeper"
        src="https://the.gatekeeperconsent.com/cmp.min.js"
        strategy="beforeInteractive"
        data-cfasync="false"
      />
      {adsEnabled ? (
        <>
          <Script id="ezoic-standalone-init" strategy="afterInteractive">
            {`window.ezstandalone = window.ezstandalone || {}; window.ezstandalone.cmd = window.ezstandalone.cmd || [];`}
          </Script>
          <Script src="https://www.ezojs.com/ezoic/sa.min.js" strategy="afterInteractive" async />
          <Script src="https://ezoicanalytics.com/analytics.js" strategy="afterInteractive" />
        </>
      ) : null}
    </>
  );
}
