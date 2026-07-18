"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ALLOWED_TOPIC_TRANSITIONS,
  TOPIC_PRIORITIES,
  TOPIC_SEARCH_INTENTS,
  TOPIC_STATUS_LABELS,
} from "@/lib/cms/topics/constants";
import type { TopicStatus } from "@/lib/cms/topics/types";
import { TopicAiSuggestions } from "./topic-ai-suggestions";

type EditableTopic = {
  id: string;
  title: string;
  workingTitle: string | null;
  summary: string | null;
  angle: string | null;
  readerProblem: string | null;
  targetAudience: string | null;
  category: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: (typeof TOPIC_SEARCH_INTENTS)[number] | null;
  relevanceScore: number | null;
  freshnessScore: number | null;
  evergreenScore: number | null;
  confidenceScore: number | null;
  priority: (typeof TOPIC_PRIORITIES)[number];
  status: TopicStatus;
  editorNotes: string | null;
  rejectionReason: string | null;
  articleId: string | null;
  calendarEntryId: string | null;
  updatedAt: string;
};

const actionLabels: Partial<Record<TopicStatus, string>> = {
  approved: "Approve Topic",
  rejected: "Reject",
  archived: "Archive",
  inbox: "Restore to Inbox",
  needs_review: "Send to Review",
};

export function TopicReviewForm({ topic }: { topic: EditableTopic }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: topic.title,
    workingTitle: topic.workingTitle ?? "",
    summary: topic.summary ?? "",
    angle: topic.angle ?? "",
    readerProblem: topic.readerProblem ?? "",
    targetAudience: topic.targetAudience ?? "",
    category: topic.category ?? "",
    primaryKeyword: topic.primaryKeyword ?? "",
    secondaryKeywords: topic.secondaryKeywords.join(", "),
    searchIntent: topic.searchIntent ?? "",
    relevanceScore: topic.relevanceScore?.toString() ?? "",
    freshnessScore: topic.freshnessScore?.toString() ?? "",
    evergreenScore: topic.evergreenScore?.toString() ?? "",
    confidenceScore: topic.confidenceScore?.toString() ?? "",
    priority: topic.priority,
    editorNotes: topic.editorNotes ?? "",
    rejectionReason: topic.rejectionReason ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function request(url: string, init: RequestInit) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(url, init);
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The request failed.");
      setMessage("Changes saved.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request failed.");
    } finally {
      setSaving(false);
    }
  }

  function parseOptionalScore(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function saveTopic() {
    return request(`/api/cms/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        workingTitle: form.workingTitle || null,
        summary: form.summary || null,
        angle: form.angle || null,
        readerProblem: form.readerProblem || null,
        targetAudience: form.targetAudience || null,
        category: form.category || null,
        primaryKeyword: form.primaryKeyword || null,
        secondaryKeywords: form.secondaryKeywords
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        searchIntent: form.searchIntent || null,
        relevanceScore: parseOptionalScore(form.relevanceScore),
        freshnessScore: parseOptionalScore(form.freshnessScore),
        evergreenScore: parseOptionalScore(form.evergreenScore),
        confidenceScore: parseOptionalScore(form.confidenceScore),
        priority: form.priority,
        editorNotes: form.editorNotes || null,
      }),
    });
  }

  function transition(toStatus: TopicStatus) {
    if (toStatus === "rejected" && !form.rejectionReason.trim()) {
      setError("Enter a rejection reason before rejecting this topic.");
      return;
    }
    return request(`/api/cms/topics/${topic.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus,
        rejectionReason: toStatus === "rejected" ? form.rejectionReason : undefined,
      }),
    });
  }

  async function deleteTopic() {
    if (!window.confirm("Permanently delete this topic? This cannot be undone.")) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/cms/topics/${topic.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to delete topic.");
      setSaving(false);
      return;
    }
    router.push("/admin/topics");
    router.refresh();
  }

  const allowed = ALLOWED_TOPIC_TRANSITIONS[topic.status] as readonly TopicStatus[];

  return (
    <>
      <section id="topic-overview" className="admin-card" aria-busy={saving}>
        <div className="topic-section-heading">
          <div>
            <h2>Topic overview</h2>
            <span className={`admin-status ${topic.status}`}>
              {TOPIC_STATUS_LABELS[topic.status]}
            </span>
          </div>
          <button className="admin-button" type="button" disabled={saving} onClick={saveTopic}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        <div className="topic-editor-grid">
          <label className="topic-field-wide">
            Title
            <input
              className="admin-input"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              minLength={1}
              maxLength={180}
            />
          </label>
          <label className="topic-field-wide">
            Working title
            <input
              className="admin-input"
              value={form.workingTitle}
              onChange={(event) => update("workingTitle", event.target.value)}
              maxLength={180}
            />
          </label>
          <label className="topic-field-wide">
            Summary
            <textarea
              className="admin-textarea"
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
              rows={3}
              maxLength={1200}
            />
          </label>
          <label className="topic-field-wide">
            Angle
            <textarea
              className="admin-textarea"
              value={form.angle}
              onChange={(event) => update("angle", event.target.value)}
              rows={3}
              maxLength={600}
            />
          </label>
          <label>
            Reader problem
            <textarea
              className="admin-textarea"
              value={form.readerProblem}
              onChange={(event) => update("readerProblem", event.target.value)}
              rows={3}
              maxLength={500}
            />
          </label>
          <label>
            Target audience
            <textarea
              className="admin-textarea"
              value={form.targetAudience}
              onChange={(event) => update("targetAudience", event.target.value)}
              rows={3}
              maxLength={200}
            />
          </label>
          <label>
            Category
            <input
              className="admin-input"
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              maxLength={150}
            />
          </label>
          <label>
            Priority
            <select
              className="admin-select"
              value={form.priority}
              onChange={(event) => update("priority", event.target.value)}
            >
              {TOPIC_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority[0].toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Primary keyword
            <input
              className="admin-input"
              value={form.primaryKeyword}
              onChange={(event) => update("primaryKeyword", event.target.value)}
              maxLength={150}
            />
          </label>
          <label>
            Search intent
            <select
              className="admin-select"
              value={form.searchIntent}
              onChange={(event) => update("searchIntent", event.target.value)}
            >
              <option value="">Not set</option>
              {TOPIC_SEARCH_INTENTS.map((intent) => (
                <option key={intent} value={intent}>
                  {intent[0].toUpperCase() + intent.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="topic-field-wide">
            Secondary keywords
            <input
              className="admin-input"
              value={form.secondaryKeywords}
              onChange={(event) => update("secondaryKeywords", event.target.value)}
              placeholder="Separate keywords with commas"
            />
          </label>
          <label>
            Relevance score
            <input
              className="admin-input"
              type="number"
              min={0}
              max={100}
              value={form.relevanceScore}
              onChange={(event) => update("relevanceScore", event.target.value)}
            />
          </label>
          <label>
            Freshness score
            <input
              className="admin-input"
              type="number"
              min={0}
              max={100}
              value={form.freshnessScore}
              onChange={(event) => update("freshnessScore", event.target.value)}
            />
          </label>
          <label>
            Evergreen score
            <input
              className="admin-input"
              type="number"
              min={0}
              max={100}
              value={form.evergreenScore}
              onChange={(event) => update("evergreenScore", event.target.value)}
            />
          </label>
          <label>
            Confidence score
            <input
              className="admin-input"
              type="number"
              min={0}
              max={100}
              value={form.confidenceScore}
              onChange={(event) => update("confidenceScore", event.target.value)}
            />
          </label>
          <label className="topic-field-wide">
            Editor notes
            <textarea
              className="admin-textarea"
              value={form.editorNotes}
              onChange={(event) => update("editorNotes", event.target.value)}
              rows={4}
              maxLength={4000}
            />
          </label>
        </div>

        {allowed.includes("rejected") ? (
          <label className="topic-rejection-field">
            Rejection reason
            <input
              className="admin-input"
              value={form.rejectionReason}
              onChange={(event) => update("rejectionReason", event.target.value)}
              maxLength={1000}
            />
          </label>
        ) : null}

        {error ? (
          <p className="admin-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="admin-success" role="status">
            {message}
          </p>
        ) : null}

        <div className="topic-actions">
          {allowed
            .filter((status) => actionLabels[status])
            .map((status) => (
              <button
                className={status === "approved" ? "admin-button" : "admin-button secondary"}
                type="button"
                disabled={saving}
                onClick={() => transition(status)}
                key={status}
              >
                {actionLabels[status]}
              </button>
            ))}
          {!topic.articleId && !topic.calendarEntryId ? (
            <button
              className="admin-button topic-danger-button"
              type="button"
              disabled={saving}
              onClick={deleteTopic}
            >
              Delete
            </button>
          ) : null}
        </div>
      </section>

      <TopicAiSuggestions
        topicId={topic.id}
        expectedUpdatedAt={topic.updatedAt}
        currentValues={{
          title: form.title,
          workingTitle: form.workingTitle,
          summary: form.summary,
          angle: form.angle,
          readerProblem: form.readerProblem,
          targetAudience: form.targetAudience,
          category: form.category,
          primaryKeyword: form.primaryKeyword,
          secondaryKeywords: form.secondaryKeywords,
          searchIntent: form.searchIntent,
          relevanceScore: form.relevanceScore,
          freshnessScore: form.freshnessScore,
          evergreenScore: form.evergreenScore,
          confidenceScore: form.confidenceScore,
          priority: form.priority,
        }}
        onApplied={() => router.refresh()}
      />
    </>
  );
}
