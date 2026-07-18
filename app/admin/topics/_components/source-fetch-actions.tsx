"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourceFetchActions({
  sourceId,
  fetchStatus,
  sourceUrl,
}: {
  sourceId: string;
  fetchStatus: string;
  sourceUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(sourceUrl);
  const retry = ["failed", "limited", "completed"].includes(fetchStatus);

  async function fetchSource() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/cms/topic-sources/${sourceId}/${retry ? "retry" : "fetch"}`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Source fetch failed.");
      router.refresh();
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Source fetch failed.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveUrl() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/cms/topic-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Source URL update failed.");
      setEditing(false);
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Source URL update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="topic-source-actions" aria-busy={busy}>
      <button
        className="admin-button secondary"
        type="button"
        disabled={busy || fetchStatus === "processing"}
        onClick={fetchSource}
      >
        {busy
          ? "Retrieving source…"
          : retry
            ? "Retry Source Fetch"
            : "Retrieve Source Details"}
      </button>
      <button
        className="admin-button secondary"
        type="button"
        disabled={busy}
        onClick={() => setEditing((value) => !value)}
      >
        {editing ? "Cancel URL Edit" : "Edit URL"}
      </button>
      {editing ? (
        <div className="topic-source-url-editor">
          <label htmlFor={`source-url-${sourceId}`}>Source URL</label>
          <input
            id={`source-url-${sourceId}`}
            className="admin-input"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            className="admin-button"
            type="button"
            disabled={busy || !url.trim()}
            onClick={saveUrl}
          >
            Save URL
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
