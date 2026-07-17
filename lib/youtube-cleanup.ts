const YOUTUBE_EMBED_FIGURE_RE =
  /<figure(?:\s[^>]*)?>\s*(https?:\/\/(?:www\.)?(?:(?:youtube\.com\/(?:watch\?[^\s<]*|embed\/|shorts\/))|(?:youtu\.be\/))[^\s<]*)\s*<\/figure>/gi;

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const DATA_API_BATCH_SIZE = 50;
const OEMBED_CONCURRENCY = 5;

export type YouTubeEmbed = {
  videoId: string;
  url: string;
};

export type YouTubeAvailabilityStatus = "available" | "unavailable" | "restricted" | "error";

export type YouTubeAvailability = {
  videoId: string;
  status: YouTubeAvailabilityStatus;
  error?: string;
};

export type YouTubeAvailabilityResult = {
  method: "youtube-data-api" | "youtube-oembed";
  videos: YouTubeAvailability[];
};

type AvailabilityOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

/** Statuses an admin may choose to remove from recovered articles. */
export const REMOVABLE_STATUSES = new Set<YouTubeAvailabilityStatus>([
  "unavailable",
  "restricted",
  "error",
]);

export function isRemovableStatus(status: YouTubeAvailabilityStatus): boolean {
  return REMOVABLE_STATUSES.has(status);
}

export function extractYouTubeEmbeds(html: string): YouTubeEmbed[] {
  const embeds: YouTubeEmbed[] = [];

  for (const match of html.matchAll(YOUTUBE_EMBED_FIGURE_RE)) {
    const url = match[1];
    const videoId = parseYouTubeVideoId(url);
    if (videoId) {
      embeds.push({ videoId, url });
    }
  }

  return embeds;
}

export function removeYouTubeEmbeds(
  html: string,
  videoIds: ReadonlySet<string>,
): { html: string; removedCount: number } {
  let removedCount = 0;
  const cleaned = html.replace(YOUTUBE_EMBED_FIGURE_RE, (figure, url: string) => {
    const videoId = parseYouTubeVideoId(url);
    if (!videoId || !videoIds.has(videoId)) {
      return figure;
    }

    removedCount += 1;
    return "";
  });

  return {
    html: cleaned.replace(/\n{5,}/g, "\n\n\n\n"),
    removedCount,
  };
}

export function parseYouTubeVideoId(value: string): string | undefined {
  try {
    const url = new URL(value.replace(/&amp;/g, "&"));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId: string | undefined;

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0];
    } else if (hostname === "youtube.com") {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v") ?? undefined;
      } else {
        const [kind, id] = url.pathname.split("/").filter(Boolean);
        if (kind === "embed" || kind === "shorts") {
          videoId = id;
        }
      }
    }

    return videoId && VIDEO_ID_RE.test(videoId) ? videoId : undefined;
  } catch {
    return undefined;
  }
}

export async function checkYouTubeAvailability(
  videoIds: readonly string[],
  options: AvailabilityOptions = {},
): Promise<YouTubeAvailabilityResult> {
  const ids = [...new Set(videoIds.filter((id) => VIDEO_ID_RE.test(id)))];
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey?.trim();

  if (apiKey) {
    return {
      method: "youtube-data-api",
      videos: await checkWithDataApi(ids, apiKey, fetchImpl),
    };
  }

  return {
    method: "youtube-oembed",
    videos: await mapWithConcurrency(ids, OEMBED_CONCURRENCY, (id) =>
      checkWithOembed(id, fetchImpl),
    ),
  };
}

async function checkWithDataApi(
  videoIds: string[],
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<YouTubeAvailability[]> {
  const statuses = new Map<string, YouTubeAvailability>();

  for (let offset = 0; offset < videoIds.length; offset += DATA_API_BATCH_SIZE) {
    const batch = videoIds.slice(offset, offset + DATA_API_BATCH_SIZE);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "status");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", apiKey);

    try {
      const response = await fetchImpl(url);
      if (!response.ok) {
        const error = `YouTube Data API returned HTTP ${response.status}.`;
        for (const videoId of batch) {
          statuses.set(videoId, { videoId, status: "error", error });
        }
        continue;
      }

      const payload = (await response.json()) as {
        items?: Array<{
          id?: unknown;
          status?: { privacyStatus?: unknown; uploadStatus?: unknown };
        }>;
      };
      const byId = new Map(
        (payload.items ?? [])
          .filter((item): item is { id: string; status?: { privacyStatus?: unknown; uploadStatus?: unknown } } =>
            typeof item.id === "string" && VIDEO_ID_RE.test(item.id),
          )
          .map((item) => [item.id, item]),
      );

      for (const videoId of batch) {
        const item = byId.get(videoId);
        if (!item) {
          // Missing from videos.list usually means deleted/removed from public index.
          statuses.set(videoId, { videoId, status: "unavailable" });
          continue;
        }

        const privacy =
          typeof item.status?.privacyStatus === "string" ? item.status.privacyStatus : "";
        const upload =
          typeof item.status?.uploadStatus === "string" ? item.status.uploadStatus : "";

        if (upload === "rejected" || upload === "deleted" || upload === "failed") {
          statuses.set(videoId, { videoId, status: "unavailable" });
        } else if (privacy === "private") {
          statuses.set(videoId, {
            videoId,
            status: "restricted",
            error: "YouTube reports this video as private.",
          });
        } else {
          statuses.set(videoId, { videoId, status: "available" });
        }
      }
    } catch (error) {
      const message = `YouTube Data API request failed: ${errorMessage(error)}`;
      for (const videoId of batch) {
        statuses.set(videoId, { videoId, status: "error", error: message });
      }
    }
  }

  return videoIds.map(
    (videoId) =>
      statuses.get(videoId) ?? {
        videoId,
        status: "error",
        error: "YouTube availability was not checked.",
      },
  );
}

async function checkWithOembed(
  videoId: string,
  fetchImpl: typeof fetch,
): Promise<YouTubeAvailability> {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set("format", "json");

  try {
    const response = await fetchImpl(url);
    if (response.ok) {
      return { videoId, status: "available" };
    }
    // 401 is common for age-restricted / embed-restricted videos that still exist.
    // Treating it as unavailable caused false deletions.
    if (response.status === 401) {
      return {
        videoId,
        status: "restricted",
        error: "YouTube oEmbed returned HTTP 401 (video exists but is restricted).",
      };
    }
    if ([404, 410].includes(response.status)) {
      return { videoId, status: "unavailable" };
    }
    // 400 can mean a bad ID, but can also be temporary; keep it as error so admins choose.
    return {
      videoId,
      status: "error",
      error: `YouTube oEmbed returned HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      videoId,
      status: "error",
      error: `YouTube oEmbed request failed: ${errorMessage(error)}`,
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown network error.";
}
