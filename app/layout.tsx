import type { Metadata, Viewport } from "next";
import { siteName, siteUrl } from "@/lib/content";
import { displayFont, sourceSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | Practical Home Guides`,
    template: `%s | ${siteName}`,
  },
  description: "Practical guides for smarter cooking, cleaning, home care, appliances, and everyday life.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sourceSans.className} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
