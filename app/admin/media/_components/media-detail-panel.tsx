"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { encodeMediaId } from "@/lib/cms/media-paths";
import { MediaLightbox } from "./media-lightbox";

export type MediaSummary = {
  id: string;
  filename: string;
  publicPath: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  mimeType: string;
  source: "database" | "recovered";
  createdAt: string | null;
  usageCount: number;
  inUse: boolean;
};

export type MediaUsage = {
  articleId: string;
  title: string;
  pathname: string;
  source: "database" | "recovered";
  roles: ("featured" | "og" | "inline")[];
};

export type MediaDetail = MediaSummary & {
  blobUrl: string | null;
  usages: MediaUsage[];
};

type MediaDetailPanelProps = {
  mediaId: string;
  onClose: () => void;
  onChanged: () => void;
};

export function MediaDetailPanel({ mediaId, onClose, onChanged }: MediaDetailPanelProps) {
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [blockingUsages, setBlockingUsages] = useState<MediaUsage[]>([]);

  useEffect(() => {
    setError("");
    setMessage("");
    setBlockingUsages([]);
    fetch(`/api/cms/media/${encodeMediaId(mediaId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { media?: MediaDetail; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load media details.");
        setMedia(data.media ?? null);
        setAlt(data.media?.alt ?? "");
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [mediaId]);

  async function saveAlt() {
    if (!media || media.source !== "database") return;
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/cms/media/${encodeMediaId(media.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt }),
    });
    const data = (await response.json()) as { media?: MediaDetail; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to update alt text.");
      return;
    }
    setMedia(data.media ?? null);
    setMessage("Alt text saved.");
    onChanged();
  }

  async function deleteMedia() {
    if (!media) return;
    if (
      !window.confirm(
        media.inUse
          ? "This media is marked as in use. Delete is blocked until references are removed."
          : "Permanently delete this media? Recovered files may remain on the CDN until the next deploy.",
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    setBlockingUsages([]);

    const response = await fetch(`/api/cms/media/${encodeMediaId(media.id)}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string; usages?: MediaUsage[] };

    setBusy(false);
    if (response.status === 409) {
      setBlockingUsages(data.usages ?? []);
      setError(data.error ?? "Media is still referenced by articles.");
      return;
    }
    if (!response.ok) {
      setError(data.error ?? "Delete failed.");
      return;
    }

    onChanged();
    onClose();
  }

  async function copyPath() {
    if (!media) return;
    await navigator.clipboard.writeText(media.publicPath);
    setMessage("Path copied.");
  }

  if (!media) {
    return (
      <aside className="media-detail-panel">
        <div className="media-detail-header">
          <h2>Media details</h2>
          <button type="button" className="admin-button" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? <p className="admin-error">{error}</p> : <p>Loading…</p>}
      </aside>
    );
  }

  return (
    <>
      <aside className="media-detail-panel">
        <div className="media-detail-header">
          <h2>{media.filename}</h2>
          <button type="button" className="admin-button" onClick={onClose}>
            Close
          </button>
        </div>

        <button type="button" className="media-detail-preview" onClick={() => setShowLightbox(true)}>
          {media.mimeType.startsWith("image/") ? (
            <img src={media.publicPath} alt={media.alt ?? media.filename} />
          ) : (
            <span>{media.mimeType}</span>
          )}
        </button>

        <dl className="media-detail-meta">
          <div>
            <dt>Source</dt>
            <dd>{media.source === "database" ? "CMS upload" : "Recovered"}</dd>
          </div>
          <div>
            <dt>Path</dt>
            <dd>{media.publicPath}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{media.width && media.height ? `${media.width} × ${media.height}` : "—"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{media.createdAt ? new Date(media.createdAt).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt>Usage</dt>
            <dd>{media.inUse ? `Used in ${media.usageCount} article(s)` : "Unused"}</dd>
          </div>
        </dl>

        <div className="media-detail-actions">
          <button type="button" className="admin-button" onClick={() => setShowLightbox(true)}>
            View full size
          </button>
          <a className="admin-button" href={media.publicPath} target="_blank" rel="noreferrer">
            Open file URL
          </a>
          <button type="button" className="admin-button" onClick={copyPath}>
            Copy path
          </button>
          <button type="button" className="admin-button admin-button-danger" disabled={busy} onClick={deleteMedia}>
            Delete
          </button>
        </div>

        {media.source === "database" ? (
          <form
            className="media-detail-alt"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAlt();
            }}
          >
            <label htmlFor="media-alt">Alt text</label>
            <input
              id="media-alt"
              className="admin-input"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
            />
            <button type="submit" className="admin-button" disabled={busy}>
              Save alt
            </button>
          </form>
        ) : null}

        {media.usages.length > 0 ? (
          <section className="media-detail-usages">
            <h3>Used in articles</h3>
            <ul>
              {media.usages.map((usage) => (
                <li key={`${usage.articleId}-${usage.roles.join("-")}`}>
                  <div>
                    <strong>{usage.title}</strong>
                    <p>{usage.roles.join(", ")}</p>
                  </div>
                  <div className="media-detail-usage-links">
                    <Link href={`/admin/articles/${usage.articleId}`}>Edit in CMS</Link>
                    <a href={usage.pathname} target="_blank" rel="noreferrer">
                      View on site
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="media-detail-empty">Not referenced by any article.</p>
        )}

        <p className="media-detail-note">
          Recovered files deleted here are hidden immediately. On production, static CDN copies may remain until the
          next deploy runs <code>npm run media:prune</code>.
        </p>

        {error ? <p className="admin-error">{error}</p> : null}
        {message ? <p className="admin-success">{message}</p> : null}
        {blockingUsages.length > 0 ? (
          <div className="admin-error">
            <p>Delete blocked by these articles:</p>
            <ul>
              {blockingUsages.map((usage) => (
                <li key={usage.articleId}>
                  <Link href={`/admin/articles/${usage.articleId}`}>{usage.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      {showLightbox ? (
        <MediaLightbox src={media.publicPath} alt={media.alt ?? media.filename} onClose={() => setShowLightbox(false)} />
      ) : null}
    </>
  );
}
