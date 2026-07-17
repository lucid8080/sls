import { Archivo_Narrow, Source_Sans_3 } from "next/font/google";

export const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
});

export const displayFont = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--font-display",
});
