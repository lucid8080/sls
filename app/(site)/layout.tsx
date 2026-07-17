import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { EzoicHeadScripts } from "@/components/ads/EzoicHeadScripts";
import { SiteAds } from "@/components/ads/SiteAds";
import { getAdSettingsSafe, toPublicAdConfig } from "@/lib/ads/settings";

export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const adSettings = await getAdSettingsSafe();
  const adConfig = toPublicAdConfig(adSettings);

  return (
    <SiteAds initialConfig={adConfig}>
      <GoogleAnalytics />
      {adConfig.globalEnabled ? <EzoicHeadScripts /> : null}
      <SiteHeader />
      {children}
      <SiteFooter />
    </SiteAds>
  );
}
