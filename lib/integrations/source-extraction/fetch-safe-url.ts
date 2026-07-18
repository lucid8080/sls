import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { TopicDomainError } from "@/lib/cms/topics/errors";
import { resolveHostSafely, type HostLookup } from "./resolve-host-safely";
import type { ResolvedPublicAddress, SafeFetchResult } from "./types";
import { parseSourceUrl } from "./validate-source-url";

const ACCEPTED_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/plain",
]);

export type SafeFetchLimits = {
  timeoutMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
};

type RawResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};

export type SafeRequest = (
  url: URL,
  address: ResolvedPublicAddress,
  limits: SafeFetchLimits,
) => Promise<RawResponse>;

function boundedEnvNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export function getSafeFetchLimits(): SafeFetchLimits {
  return {
    timeoutMs: boundedEnvNumber("TOPIC_SOURCE_FETCH_TIMEOUT_MS", 8_000, 1_000, 20_000),
    maxResponseBytes: boundedEnvNumber(
      "TOPIC_SOURCE_MAX_RESPONSE_BYTES",
      1_500_000,
      32_000,
      5_000_000,
    ),
    maxRedirects: 3,
  };
}

export const requestPinnedUrl: SafeRequest = (url, resolved, limits) =>
  new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    let settled = false;

    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (typeof options === "object" && options.all) {
        callback(null, [{ address: resolved.address, family: resolved.family }]);
        return;
      }
      callback(null, resolved.address, resolved.family);
    };

    const request = transport.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "text/html, application/xhtml+xml, text/plain;q=0.8",
          "Accept-Encoding": "identity",
          "User-Agent": "SimpleLifeSaver-TopicInbox/1.0 (+https://simplelifesaver.com)",
        },
        lookup: pinnedLookup,
        timeout: limits.timeoutMs,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers["content-type"] ?? "")
          .split(";")[0]
          .trim()
          .toLowerCase();
        if (
          status >= 200 &&
          status < 300 &&
          !ACCEPTED_CONTENT_TYPES.has(contentType)
        ) {
          settled = true;
          response.destroy();
          reject(
            new TopicDomainError(
              "SOURCE_CONTENT_UNSUPPORTED",
              "The source content type is not supported.",
            ),
          );
          return;
        }
        const contentLength = Number(response.headers["content-length"] ?? 0);
        if (contentLength > limits.maxResponseBytes) {
          settled = true;
          response.destroy();
          reject(
            new TopicDomainError(
              "SOURCE_FETCH_TOO_LARGE",
              "The source response was too large to process safely.",
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.length;
          if (size > limits.maxResponseBytes) {
            settled = true;
            response.destroy();
            reject(
              new TopicDomainError(
                "SOURCE_FETCH_TOO_LARGE",
                "The source response was too large to process safely.",
              ),
            );
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({
            status,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(
        new TopicDomainError(
          "SOURCE_FETCH_TIMEOUT",
          "The source took too long to respond.",
        ),
      );
    });
    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(
        error instanceof TopicDomainError
          ? error
          : new TopicDomainError(
              "SOURCE_FETCH_FAILED",
              "The public source could not be fetched.",
              { cause: error },
            ),
      );
    });
    request.end();
  });

export async function fetchSafeUrl(
  input: string,
  options?: {
    lookup?: HostLookup;
    request?: SafeRequest;
    limits?: Partial<SafeFetchLimits>;
  },
): Promise<SafeFetchResult> {
  const requested = parseSourceUrl(input);
  const limits = { ...getSafeFetchLimits(), ...options?.limits };
  const request = options?.request ?? requestPinnedUrl;
  let current = requested;

  for (let redirectCount = 0; redirectCount <= limits.maxRedirects; redirectCount += 1) {
    parseSourceUrl(current.toString());
    const addresses = await resolveHostSafely(current.hostname, options?.lookup);
    const response = await request(current, addresses[0], limits);
    if (Buffer.byteLength(response.body, "utf8") > limits.maxResponseBytes) {
      throw new TopicDomainError(
        "SOURCE_FETCH_TOO_LARGE",
        "The source response was too large to process safely.",
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location) {
        throw new TopicDomainError(
          "SOURCE_FETCH_FAILED",
          "The source returned an invalid redirect.",
        );
      }
      if (redirectCount >= limits.maxRedirects) {
        throw new TopicDomainError(
          "SOURCE_FETCH_FAILED",
          "The source redirected too many times.",
        );
      }
      current = parseSourceUrl(new URL(location, current).toString());
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new TopicDomainError(
        "SOURCE_FETCH_FAILED",
        `The source returned HTTP ${response.status || "error"}.`,
      );
    }

    const contentType = String(response.headers["content-type"] ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ACCEPTED_CONTENT_TYPES.has(contentType)) {
      throw new TopicDomainError(
        "SOURCE_CONTENT_UNSUPPORTED",
        "The source content type is not supported.",
      );
    }

    return {
      requestedUrl: requested.toString(),
      finalUrl: current.toString(),
      status: response.status,
      contentType,
      body: response.body,
      redirectCount,
    };
  }

  throw new TopicDomainError("SOURCE_FETCH_FAILED", "The source could not be fetched.");
}

export { ACCEPTED_CONTENT_TYPES };
