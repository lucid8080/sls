export type AffiliateLiveStatus =
  | "unchecked"
  | "active"
  | "dead"
  | "redirected"
  | "blocked"
  | "error";

export type AffiliateCheckResult = {
  liveStatus: AffiliateLiveStatus;
  liveStatusCode: number | null;
  liveFinalUrl: string | null;
  liveError: string | null;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export function classifyHttpStatus(
  status: number,
  options: { redirected?: boolean; finalUrl?: string | null; requestUrl?: string } = {},
): AffiliateLiveStatus {
  if (options.redirected || (status >= 300 && status < 400)) {
    return "redirected";
  }
  if (status >= 200 && status < 300) {
    return "active";
  }
  if (status === 404 || status === 410) {
    return "dead";
  }
  if (status === 403 || status === 401 || status === 429 || status === 503) {
    return "blocked";
  }
  if (status >= 500) {
    return "error";
  }
  return "error";
}

export async function checkAffiliateUrl(
  url: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<AffiliateCheckResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "SLS-AffiliateLinkChecker/1.0 (+https://simplelifesaver.com)",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    const location = response.headers.get("location");
    const redirected = response.status >= 300 && response.status < 400;
    let finalUrl: string | null = null;
    if (location) {
      try {
        finalUrl = new URL(location, url).toString();
      } catch {
        finalUrl = location;
      }
    }

    const liveStatus = classifyHttpStatus(response.status, {
      redirected,
      finalUrl,
      requestUrl: url,
    });

    return {
      liveStatus,
      liveStatusCode: response.status,
      liveFinalUrl: finalUrl,
      liveError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? `Timed out after ${timeoutMs}ms`
          : error.message
        : "Unknown network error";
    return {
      liveStatus: "error",
      liveStatusCode: null,
      liveFinalUrl: null,
      liveError: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAffiliateUrls(
  urls: Array<{ id: string; url: string }>,
  options: {
    concurrency?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    onResult?: (id: string, result: AffiliateCheckResult) => void | Promise<void>;
  } = {},
): Promise<Map<string, AffiliateCheckResult>> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 5));
  const results = new Map<string, AffiliateCheckResult>();
  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const current = urls[index];
      index += 1;
      const result = await checkAffiliateUrl(current.url, {
        timeoutMs: options.timeoutMs,
        fetchImpl: options.fetchImpl,
      });
      results.set(current.id, result);
      if (options.onResult) {
        await options.onResult(current.id, result);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  return results;
}
