import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const adsTxtManagerId = process.env.EZOIC_ADSTXT_MANAGER_ID?.trim() || "20975";
const adsTxtDomain = process.env.EZOIC_ADSTXT_DOMAIN?.trim() || "simplelifesaver.com";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/ads.txt",
        destination: `https://srv.adstxtmanager.com/${adsTxtManagerId}/${adsTxtDomain}`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
