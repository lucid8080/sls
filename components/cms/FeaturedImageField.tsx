"use client";

import { useEffect, useState } from "react";
import { featuredImageFromMediaAsset } from "@/lib/cms/featured-image";
import type { FeaturedImage } from "@/lib/cms/schemas";

type MediaListItem = {
  id: string;
  filename: string;
  publicPath: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  mimeType: string;
  source: "database" | "recovered";
};

type FeaturedImageFieldProps = {
  value: FeaturedImage | null;
  onChange: (value: FeaturedImage | null) => void;
  disabled?: boolean;
};

const PAGE_SIZE = 24;

export function FeaturedImageField({ value, onChange, disabled = false }: FeaturedImageFieldProps) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [media, setMedia] = useState<MediaListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!browseOpen) return;

    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search.trim()) params.set("search", search.trim());

    setLoadingMedia(true);
    setError("");
    fetch(`/api/cms/media?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          media?: MediaListItem[];
          total?: number;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load media.");
        }
        setMedia(data.media ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((loadError: Error) => {
        setMedia([]);
        setTotal(0);
        setError(loadError.message);
      })
      .finally(() => setLoadingMedia(false));
  }, [browseOpen, offset, search, reloadToken]);

  function selectAsset(asset: MediaListItem) {
    const next = featuredImageFromMediaAsset(asset);
    if (!next) {
      setError("Selected media path is not a valid /media/… URL.");
      return;
    }
    onChange(next);
    setBrowseOpen(false);
    setError("");
  }

  async function uploadFile(file: File | null) {
    if (!file || disabled) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("alt", value?.alt ?? "");

    try {
      const response = await fetch("/api/cms/media", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        media?: MediaListItem;
        error?: string;
      };
      if (!response.ok || !data.media) {
        throw new Error(data.error ?? "Upload failed.");
      }
      const next = featuredImageFromMediaAsset(data.media);
      if (!next) {
        throw new Error("Upload succeeded but returned an invalid media path.");
      }
      onChange(next);
      setReloadToken((token) => token + 1);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function updateMeta(patch: Partial<Pick<FeaturedImage, "alt" | "caption">>) {
    if (!value) return;
    onChange({
      ...value,
      ...patch,
      caption: patch.caption === "" ? undefined : (patch.caption ?? value.caption),
    });
  }

  const busy = disabled || uploading;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="featured-image-field">
      <span className="featured-image-field-label">Post image</span>
      <div className="featured-image-field-body">
        <div className="featured-image-preview" aria-hidden={!value}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.src} alt={value.alt || ""} width={value.width} height={value.height} />
          ) : (
            <span className="featured-image-empty">No image selected</span>
          )}
        </div>

        <div className="featured-image-controls">
          {value ? (
            <>
              <label>
                <span>Alt text</span>
                <input
                  className="admin-input"
                  value={value.alt}
                  disabled={busy}
                  onChange={(e) => updateMeta({ alt: e.target.value })}
                  placeholder="Describe the image"
                />
              </label>
              <label>
                <span>Caption (optional)</span>
                <input
                  className="admin-input"
                  value={value.caption ?? ""}
                  disabled={busy}
                  onChange={(e) => updateMeta({ caption: e.target.value })}
                  placeholder="Caption shown under the hero"
                />
              </label>
            </>
          ) : null}

          <div className="featured-image-actions">
            <button
              className="admin-button secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setBrowseOpen(true);
                setOffset(0);
              }}
            >
              Browse media
            </button>
            <label className={`admin-button secondary featured-image-upload${busy ? " is-disabled" : ""}`}>
              {uploading ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                hidden
                onChange={(e) => {
                  void uploadFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
            {value ? (
              <button
                className="admin-button secondary"
                type="button"
                disabled={busy}
                onClick={() => onChange(null)}
              >
                Clear
              </button>
            ) : null}
          </div>

          {value ? <p className="featured-image-path">{value.src}</p> : null}
          {error ? <p className="admin-error">{error}</p> : null}
        </div>
      </div>

      {browseOpen ? (
        <div className="media-picker-modal" role="dialog" aria-modal="true" aria-label="Choose media">
          <button
            type="button"
            className="media-picker-backdrop"
            aria-label="Close media picker"
            onClick={() => setBrowseOpen(false)}
          />
          <div className="media-picker-panel">
            <div className="media-picker-header">
              <h2>Choose media</h2>
              <button className="admin-button secondary" type="button" onClick={() => setBrowseOpen(false)}>
                Close
              </button>
            </div>
            <div className="media-picker-toolbar">
              <input
                className="admin-input"
                placeholder="Search media…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
              />
              <p className="media-picker-count">
                {loadingMedia ? "Loading…" : `Showing ${pageStart}–${pageEnd} of ${total}`}
              </p>
            </div>
            {error && browseOpen ? <p className="admin-error">{error}</p> : null}
            <div className="media-picker-grid">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="media-picker-card"
                  onClick={() => selectAsset(item)}
                  disabled={busy || !item.mimeType.startsWith("image/")}
                >
                  <span className="media-picker-thumb">
                    {item.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.publicPath} alt={item.alt ?? item.filename} loading="lazy" />
                    ) : (
                      <span>{item.mimeType}</span>
                    )}
                  </span>
                  <span className="media-picker-filename">{item.filename}</span>
                  <span className="media-badge">{item.source === "database" ? "CMS" : "Recovered"}</span>
                </button>
              ))}
              {!loadingMedia && media.length === 0 ? (
                <p className="media-library-empty">No media found for the current search.</p>
              ) : null}
            </div>
            <div className="media-picker-pagination">
              <button
                className="admin-button secondary"
                type="button"
                disabled={offset === 0 || loadingMedia}
                onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              >
                Previous
              </button>
              <button
                className="admin-button secondary"
                type="button"
                disabled={offset + PAGE_SIZE >= total || loadingMedia}
                onClick={() => setOffset((current) => current + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
