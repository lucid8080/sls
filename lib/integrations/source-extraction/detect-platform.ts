import type { SourcePlatform } from "./types";

function isHost(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function detectSourcePlatform(input: string | URL): SourcePlatform {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    return "unknown";
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isHost(host, "youtube.com") || isHost(host, "youtu.be")) return "youtube";
  if (isHost(host, "x.com")) return "x";
  if (isHost(host, "twitter.com")) return "twitter";
  if (isHost(host, "instagram.com")) return "instagram";
  if (isHost(host, "tiktok.com")) return "tiktok";
  if (isHost(host, "reddit.com") || isHost(host, "redd.it")) return "reddit";
  if (isHost(host, "linkedin.com")) return "linkedin";
  if (isHost(host, "facebook.com") || isHost(host, "fb.watch")) return "facebook";
  if (isHost(host, "threads.net")) return "threads";
  return url.protocol === "http:" || url.protocol === "https:" ? "generic_web" : "unknown";
}

export function isLimitedSocialPlatform(platform: SourcePlatform): boolean {
  return [
    "x",
    "twitter",
    "instagram",
    "tiktok",
    "linkedin",
    "facebook",
    "threads",
  ].includes(platform);
}
