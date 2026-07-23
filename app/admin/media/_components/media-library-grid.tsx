"use client";

import type { MediaSummary } from "./media-detail-panel";

type MediaLibraryGridProps = {
  media: MediaSummary[];
  selectedId: string | null;
  checkedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleChecked: (id: string) => void;
};

export function MediaLibraryGrid({
  media,
  selectedId,
  checkedIds,
  onSelect,
  onToggleChecked,
}: MediaLibraryGridProps) {
  if (media.length === 0) {
    return <p className="media-library-empty">No media found for the current filters.</p>;
  }

  return (
    <div className="media-library-grid">
      {media.map((asset) => {
        const isChecked = checkedIds.has(asset.id);
        const isSelected = selectedId === asset.id;
        return (
          <div
            key={asset.id}
            className={`media-library-card${isSelected ? " is-selected" : ""}${isChecked ? " is-checked" : ""}`}
          >
            <label className="media-library-check">
              <input
                type="checkbox"
                checked={isChecked}
                aria-label={`Select ${asset.filename}`}
                onChange={() => onToggleChecked(asset.id)}
              />
            </label>
            <button
              type="button"
              className="media-library-card-select"
              onClick={() => onSelect(asset.id)}
            >
              <div className="media-library-thumb">
                {asset.mimeType.startsWith("image/") ? (
                  <img src={asset.publicPath} alt={asset.alt ?? asset.filename} loading="lazy" />
                ) : (
                  <span>{asset.mimeType}</span>
                )}
              </div>
              <div className="media-library-card-body">
                <p className="media-library-filename">{asset.filename}</p>
                <div className="media-library-badges">
                  <span className="media-badge">{asset.source === "database" ? "CMS" : "Recovered"}</span>
                  {asset.inUse ? (
                    <span className="media-badge media-badge-inuse">In use ({asset.usageCount})</span>
                  ) : (
                    <span className="media-badge media-badge-unused">Unused</span>
                  )}
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
