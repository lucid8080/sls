export const DEFAULT_GA4_MEASUREMENT_ID = "G-Y029QN6YPB";

export function getGoogleAnalyticsConfig(measurementId: string) {
  const normalizedId = measurementId.trim().toUpperCase();

  if (!/^G-[A-Z0-9]{6,}$/.test(normalizedId)) {
    throw new Error(`Invalid GA4 measurement ID: ${measurementId}`);
  }

  return {
    measurementId: normalizedId,
    scriptSrc: `https://www.googletagmanager.com/gtag/js?id=${normalizedId}`,
    initScript: `
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${normalizedId}');
`.trim(),
  };
}
