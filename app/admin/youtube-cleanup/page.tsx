"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type VideoStatus = "available" | "unavailable" | "restricted" | "error";

type ScanItem = {
  articleId: string;
  articleTitle: string;
  pathname: string;
  videoId: string;
  url: string;
  status: VideoStatus;
  error?: string;
};

type ScanResult = {
  checkedAt: string;
  method: "youtube-data-api" | "youtube-oembed";
  articleCount: number;
  embedCount: number;
  uniqueVideoCount: number;
  unavailableCount: number;
  restrictedCount: number;
  errorCount: number;
  items: ScanItem[];
};

type RemovalResult = {
  removedEmbedCount: number;
  updatedArticleCount: number;
  skippedVideoIds: string[];
  skippedReasons?: Record<string, string>;
  revalidated: boolean;
};

const REMOVABLE_STATUSES = new Set<VideoStatus>(["unavailable", "restricted", "error"]);

export default function AdminYouTubeCleanupPage() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"scan" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const videos = useMemo(() => {
    const grouped = new Map<
      string,
      Pick<ScanItem, "videoId" | "url" | "status" | "error"> & {
        articles: Array<
          Pick<ScanItem, "articleId" | "articleTitle" | "pathname"> & { embedCount: number }
        >;
      }
    >();

    for (const item of scan?.items ?? []) {
      const existing = grouped.get(item.videoId);
      if (existing) {
        const article = existing.articles.find((entry) => entry.articleId === item.articleId);
        if (article) {
          article.embedCount += 1;
        } else {
          existing.articles.push({ ...item, embedCount: 1 });
        }
      } else {
        grouped.set(item.videoId, {
          videoId: item.videoId,
          url: item.url,
          status: item.status,
          error: item.error,
          articles: [{ ...item, embedCount: 1 }],
        });
      }
    }

    return [...grouped.values()].sort((left, right) => {
      const rank: Record<VideoStatus, number> = {
        unavailable: 0,
        restricted: 1,
        error: 2,
        available: 3,
      };
      return rank[left.status] - rank[right.status] || left.videoId.localeCompare(right.videoId);
    });
  }, [scan]);

  const selectableVideos = videos.filter((video) => REMOVABLE_STATUSES.has(video.status));

  async function runScan(options?: { keepMessage?: boolean }) {
    setBusy("scan");
    setError("");
    if (!options?.keepMessage) {
      setMessage("");
    }

    try {
      const response = await fetch("/api/cms/youtube-cleanup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      const data = (await response.json()) as { scan?: ScanResult; error?: string };
      if (!response.ok || !data.scan) {
        throw new Error(data.error ?? "The recovered-content scan failed.");
      }

      setScan(data.scan);
      // Default-select only confirmed unavailable; error/restricted stay optional.
      setSelected(
        new Set(
          data.scan.items
            .filter((item) => item.status === "unavailable")
            .map((item) => item.videoId),
        ),
      );
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "The scan failed.");
    } finally {
      setBusy(null);
    }
  }

  function toggleVideo(videoId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  }

  function selectByStatus(statuses: VideoStatus[]) {
    const wanted = new Set(statuses);
    setSelected(
      new Set(videos.filter((video) => wanted.has(video.status)).map((video) => video.videoId)),
    );
  }

  async function removeSelected() {
    if (selected.size === 0) {
      return;
    }
    if (
      !window.confirm(
        `Remove ${selected.size} selected video${selected.size === 1 ? "" : "s"} from every affected recovered article? Available videos will be skipped on recheck.`,
      )
    ) {
      return;
    }

    setBusy("remove");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/cms/youtube-cleanup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remove", videoIds: [...selected] }),
      });
      const data = (await response.json()) as { result?: RemovalResult; error?: string };
      if (!response.ok || !data.result) {
        throw new Error(data.error ?? "The bulk removal failed.");
      }

      const deployment = data.result.revalidated
        ? " Live pages were refreshed."
        : " No public pages needed refreshing.";
      const skipped =
        data.result.skippedVideoIds.length > 0
          ? ` ${data.result.skippedVideoIds.length} video(s) were skipped (usually because recheck found them available).`
          : "";
      setMessage(
        `Removed ${data.result.removedEmbedCount} embed(s) from ${data.result.updatedArticleCount} recovered article(s).${deployment}${skipped}`,
      );
      await runScan({ keepMessage: true });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The bulk removal failed.");
      setBusy(null);
    }
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <div className="admin-youtube-header">
          <div>
            <h1>YouTube cleanup</h1>
            <p className="admin-ads-description">
              Find YouTube embeds in recovered articles and remove selected ones in bulk. You can
              remove unavailable, restricted, or error-status videos. Regular YouTube links and
              CMS-authored articles are not changed.
            </p>
          </div>
          <button
            className="admin-button"
            type="button"
            disabled={busy !== null}
            onClick={() => runScan()}
          >
            {busy === "scan" ? "Scanning…" : "Scan recovered articles"}
          </button>
        </div>

        <p className="admin-ads-note">
          The scan uses the YouTube Data API when <code>YOUTUBE_API_KEY</code> is configured;
          otherwise it uses YouTube&apos;s oEmbed endpoint. Restricted videos (age/embed limits)
          are no longer labeled unavailable. Recheck skips only videos confirmed available.
        </p>

        {error ? <p className="admin-error">{error}</p> : null}
        {message ? <p className="admin-success">{message}</p> : null}
      </section>

      {scan ? (
        <section className="admin-card">
          <div className="admin-youtube-summary">
            <span>
              <strong>{scan.uniqueVideoCount}</strong> unique videos
            </span>
            <span>
              <strong>{scan.embedCount}</strong> embeds
            </span>
            <span>
              <strong>{scan.articleCount}</strong> articles
            </span>
            <span className={scan.unavailableCount > 0 ? "admin-error" : ""}>
              <strong>{scan.unavailableCount}</strong> unavailable
            </span>
            <span>
              <strong>{scan.restrictedCount ?? 0}</strong> restricted
            </span>
            <span>
              <strong>{scan.errorCount}</strong> errors
            </span>
          </div>
          <p className="admin-ads-note">
            Checked {new Date(scan.checkedAt).toLocaleString()} via{" "}
            {scan.method === "youtube-data-api" ? "YouTube Data API" : "YouTube oEmbed"}.
          </p>

          {videos.length === 0 ? (
            <p>No supported YouTube embeds were found in recovered articles.</p>
          ) : (
            <>
              <div className="admin-youtube-actions">
                <div className="admin-youtube-select-actions">
                  <button
                    className="admin-button secondary"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => selectByStatus(["unavailable"])}
                  >
                    Select unavailable
                  </button>
                  <button
                    className="admin-button secondary"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => selectByStatus(["error"])}
                  >
                    Select errors
                  </button>
                  <button
                    className="admin-button secondary"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => selectByStatus(["restricted"])}
                  >
                    Select restricted
                  </button>
                  <button
                    className="admin-button secondary"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => selectByStatus(["unavailable", "restricted", "error"])}
                  >
                    Select all removable ({selectableVideos.length})
                  </button>
                  <button
                    className="admin-button secondary"
                    type="button"
                    disabled={busy !== null || selected.size === 0}
                    onClick={() => setSelected(new Set())}
                  >
                    Clear selection
                  </button>
                </div>
                <button
                  className="admin-button"
                  type="button"
                  disabled={busy !== null || selected.size === 0}
                  onClick={removeSelected}
                >
                  {busy === "remove"
                    ? "Removing…"
                    : `Remove selected (${selected.size})`}
                </button>
              </div>

              <div className="admin-youtube-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th aria-label="Select" />
                      <th>Video</th>
                      <th>Status</th>
                      <th>Affected recovered articles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map((video) => {
                      const canSelect = REMOVABLE_STATUSES.has(video.status);
                      return (
                        <tr key={video.videoId}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${video.videoId}`}
                              checked={selected.has(video.videoId)}
                              disabled={!canSelect || busy !== null}
                              onChange={() => toggleVideo(video.videoId)}
                            />
                          </td>
                          <td>
                            <a href={video.url} target="_blank" rel="noreferrer">
                              {video.videoId}
                            </a>
                          </td>
                          <td>
                            <span className={`admin-youtube-status ${video.status}`}>
                              {video.status}
                            </span>
                            {video.error ? <p className="admin-ads-note">{video.error}</p> : null}
                          </td>
                          <td>
                          <ul className="admin-youtube-articles">
                            {video.articles.map((article) => (
                              <li key={`${video.videoId}-${article.articleId}`}>
                                <Link href={article.pathname} target="_blank">
                                  {article.articleTitle}
                                </Link>
                                {article.embedCount > 1 ? (
                                  <span className="admin-ads-note">
                                    {" "}
                                    ({article.embedCount} embeds)
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
