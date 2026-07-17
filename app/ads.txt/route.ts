import { NextResponse } from "next/server";

/**
 * Redirects to Ads.txt Manager (recovered ID 20975 from the old WordPress site).
 * Ezoic requires a reachable ads.txt for demand partners.
 */
const ADSTXT_MANAGER_ID = process.env.EZOIC_ADSTXT_MANAGER_ID ?? "20975";
const ADSTXT_DOMAIN = process.env.EZOIC_ADSTXT_DOMAIN ?? "simplelifesaver.com";

export function GET() {
  const target = `https://srv.adstxtmanager.com/${ADSTXT_MANAGER_ID}/${ADSTXT_DOMAIN}`;
  return NextResponse.redirect(target, 301);
}
