"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { detectSourcePlatform } from "@/lib/integrations/source-extraction/detect-platform";

function inferSourceType(value: string): "manual" | "keyword" {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) || trimmed.split(/\s+/).length > 8
    ? "manual"
    : "keyword";
}

export function TopicCaptureForm() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sourceType = useMemo(() => inferSourceType(inputValue), [inputValue]);
  const isUrl = /^https?:\/\//i.test(inputValue.trim());
  const platform = useMemo(
    () => (isUrl ? detectSourcePlatform(inputValue.trim()) : null),
    [inputValue, isUrl],
  );

  async function save() {
    if (!inputValue.trim() || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/cms/topic-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputValue,
          ...(isUrl ? { sourceUrl: inputValue.trim() } : { sourceType }),
          category: category || undefined,
          editorNotes: notes || undefined,
        }),
      });
      const data = (await response.json()) as {
        topic?: { id: string };
        source?: { id: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save topic.");
      }

      let fetchWarning = "";
      if (isUrl && data.source?.id) {
        try {
          const fetchResponse = await fetch(
            `/api/cms/topic-sources/${data.source.id}/fetch`,
            { method: "POST" },
          );
          if (!fetchResponse.ok) {
            const fetchData = (await fetchResponse.json()) as { error?: string };
            fetchWarning = ` Source details could not be retrieved: ${
              fetchData.error ?? "fetch failed"
            }`;
          }
        } catch {
          fetchWarning =
            " Source details could not be retrieved because the request was interrupted.";
        }
      }
      setInputValue("");
      setCategory("");
      setNotes("");
      setSuccess(`Topic saved to the inbox.${fetchWarning}`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save topic.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-card topic-capture" aria-busy={saving}>
      <div>
        <h2>Add Topic</h2>
        <p>Capture a rough idea or keyword now. You can refine it later.</p>
      </div>
      <label htmlFor="topic-input">Topic, keyword, note, or URL</label>
      <textarea
        id="topic-input"
        className="admin-textarea topic-capture-input"
        placeholder="Paste a topic, keyword, note, or URL..."
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        rows={3}
        maxLength={4000}
      />
      {inputValue.trim() ? (
        <p className="topic-detection" aria-live="polite">
          Detected as{" "}
          {isUrl
            ? platform === "generic_web"
              ? "web page"
              : platform
            : sourceType === "keyword"
              ? "keyword"
              : "manual idea"}
        </p>
      ) : null}
      <div className="topic-form-row">
        <label>
          Optional category
          <input
            className="admin-input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={150}
          />
        </label>
        <label>
          Why is this interesting? (optional)
          <input
            className="admin-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={4000}
          />
        </label>
      </div>
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="admin-success" role="status">
          {success}
        </p>
      ) : null}
      <div className="topic-actions">
        <button
          className="admin-button"
          type="button"
          disabled={saving || !inputValue.trim()}
          onClick={save}
        >
          {saving ? "Saving…" : "Save to Inbox"}
        </button>
      </div>
    </section>
  );
}
