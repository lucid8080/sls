"use client";

import { useEffect, useState } from "react";
import { MediaDetailPanel, type MediaSummary } from "./_components/media-detail-panel";
import { MediaLibraryGrid } from "./_components/media-library-grid";

const PAGE_SIZE = 50;

type BulkDeleteResult = {
  deleted: string[];
  blocked: Array<{ id: string; usages: unknown[] }>;
  notFound: string[];
};

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [inUse, setInUse] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    if (inUse) params.set("inUse", inUse);

    fetch(`/api/cms/media?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          media?: MediaSummary[];
          total?: number;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Failed to load media.");
        setMedia(data.media ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [offset, search, source, inUse, reloadToken]);

  useEffect(() => {
    setOffset(0);
    setCheckedIds(new Set());
  }, [search, source, inUse]);

  useEffect(() => {
    setCheckedIds(new Set());
  }, [offset]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt", alt);

    const response = await fetch("/api/cms/media", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }

    setMessage("Uploaded.");
    setFile(null);
    setAlt("");
    setOffset(0);
    setSelectedId(null);
    setCheckedIds(new Set());
    setReloadToken((value) => value + 1);
  }

  function toggleChecked(id: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllOnPage() {
    setCheckedIds(new Set(media.map((asset) => asset.id)));
  }

  function selectUnusedOnPage() {
    setCheckedIds(new Set(media.filter((asset) => !asset.inUse).map((asset) => asset.id)));
  }

  function clearSelection() {
    setCheckedIds(new Set());
  }

  async function deleteSelected() {
    if (checkedIds.size === 0 || busy) {
      return;
    }

    if (
      !window.confirm(
        `Delete ${checkedIds.size} selected media item${checkedIds.size === 1 ? "" : "s"}? Items still used by articles will be skipped.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/cms/media/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: [...checkedIds] }),
      });
      const data = (await response.json()) as {
        result?: BulkDeleteResult;
        error?: string;
      };
      if (!response.ok || !data.result) {
        throw new Error(data.error ?? "Bulk delete failed.");
      }

      const { deleted, blocked, notFound } = data.result;
      const parts = [`Deleted ${deleted.length}.`];
      if (blocked.length > 0) {
        parts.push(`Skipped ${blocked.length} in use.`);
      }
      if (notFound.length > 0) {
        parts.push(`${notFound.length} not found.`);
      }
      setMessage(parts.join(" "));
      setCheckedIds(new Set());
      if (selectedId && deleted.includes(selectedId)) {
        setSelectedId(null);
      }
      setReloadToken((value) => value + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Bulk delete failed.");
    } finally {
      setBusy(false);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + media.length, total);

  return (
    <div className={`admin-grid media-library-page${selectedId ? " has-detail" : ""}`}>
      <section className="admin-card media-library-main">
        <h1>Media library</h1>
        <form className="admin-grid media-upload-form" onSubmit={upload}>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <input className="admin-input" placeholder="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} />
          <button className="admin-button" type="submit">
            Upload
          </button>
        </form>

        <div className="media-library-filters">
          <select className="admin-select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            <option value="database">CMS uploads</option>
            <option value="recovered">Recovered</option>
          </select>
          <select className="admin-select" value={inUse} onChange={(e) => setInUse(e.target.value)}>
            <option value="">All usage</option>
            <option value="true">In use</option>
            <option value="false">Unused</option>
          </select>
          <input
            className="admin-input"
            placeholder="Search filename or path"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="media-library-bulk-actions">
          <button className="admin-button" type="button" disabled={busy || media.length === 0} onClick={selectAllOnPage}>
            Select all on page
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busy || media.every((asset) => asset.inUse)}
            onClick={selectUnusedOnPage}
          >
            Select unused on page
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busy || checkedIds.size === 0}
            onClick={clearSelection}
          >
            Clear selection
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busy || checkedIds.size === 0}
            onClick={deleteSelected}
          >
            {busy ? "Deleting…" : `Delete selected (${checkedIds.size})`}
          </button>
          {checkedIds.size > 0 ? (
            <span className="media-library-bulk-count">{checkedIds.size} selected</span>
          ) : null}
        </div>

        <p className="media-library-count">
          {total === 0 ? "No media found." : `Showing ${pageStart}-${pageEnd} of ${total}`}
        </p>

        {error ? <p className="admin-error">{error}</p> : null}
        {message ? <p className="admin-success">{message}</p> : null}

        <MediaLibraryGrid
          media={media}
          selectedId={selectedId}
          checkedIds={checkedIds}
          onSelect={setSelectedId}
          onToggleChecked={toggleChecked}
        />

        <div className="media-library-pagination">
          <button
            className="admin-button"
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      </section>

      {selectedId ? (
        <MediaDetailPanel
          mediaId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => setReloadToken((value) => value + 1)}
        />
      ) : null}
    </div>
  );
}
