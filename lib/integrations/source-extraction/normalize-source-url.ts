const TRACKING_PARAMETERS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

function removeTrackingParameters(url: URL) {
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
}

function normalizeYouTube(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
    if (["shorts", "embed", "live"].includes(segments[0] ?? "")) {
      videoId = segments[1] ?? "";
    }
  }

  if (videoId && /^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    const preserved = new URLSearchParams();
    preserved.set("v", videoId);
    for (const key of ["t", "start", "list"]) {
      const value = url.searchParams.get(key);
      if (value) preserved.set(key, value);
    }
    url.hostname = "youtube.com";
    url.pathname = "/watch";
    url.search = preserved.toString();
  }
}

export function normalizeSourceUrl(input: string | URL): string {
  const url = input instanceof URL ? new URL(input.toString()) : new URL(input);
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if (
    ["twitter.com", "www.twitter.com", "mobile.twitter.com", "www.x.com"].includes(
      url.hostname,
    )
  ) {
    url.hostname = "x.com";
  }

  normalizeYouTube(url);
  removeTrackingParameters(url);

  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  return url.toString();
}

export { TRACKING_PARAMETERS };
