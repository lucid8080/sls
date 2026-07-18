"use client";

import { useMemo, useState } from "react";
import type { TopicAiSuggestion, TopicAiSuggestionField } from "@/lib/cms/topics/schemas";

type CurrentValues = Record<TopicAiSuggestionField, string>;

type SuggestionResponse = {
  suggestions: TopicAiSuggestion;
  generatedAt: string;
  model: string;
  expectedUpdatedAt: string;
  warnings?: Array<{ sourceId: string; fetchStatus: string; message: string }>;
  error?: string;
  code?: string;
};

const FIELD_LABELS: Record<TopicAiSuggestionField, string> = {
  title: "Title",
  workingTitle: "Working title",
  summary: "Summary",
  angle: "Angle",
  readerProblem: "Reader problem",
  targetAudience: "Target audience",
  category: "Category",
  primaryKeyword: "Primary keyword",
  secondaryKeywords: "Secondary keywords",
  searchIntent: "Search intent",
  relevanceScore: "Relevance score",
  freshnessScore: "Freshness score",
  evergreenScore: "Evergreen score",
  confidenceScore: "Confidence score",
  priority: "Priority",
};

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
}

export function TopicAiSuggestions({
  topicId,
  currentValues,
  expectedUpdatedAt,
  onApplied,
}: {
  topicId: string;
  currentValues: CurrentValues;
  expectedUpdatedAt: string;
  onApplied: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<SuggestionResponse | null>(null);
  const [selected, setSelected] = useState<Set<TopicAiSuggestionField>>(new Set());

  const suggestedFields = useMemo(() => {
    if (!payload?.suggestions) return [] as TopicAiSuggestionField[];
    return (Object.keys(FIELD_LABELS) as TopicAiSuggestionField[]).filter(
      (field) => payload.suggestions[field] !== undefined,
    );
  }, [payload]);

  function toggleField(field: TopicAiSuggestionField) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(suggestedFields));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function generate() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/cms/topics/${topicId}/suggestions`, {
        method: "POST",
      });
      const data = (await response.json()) as SuggestionResponse;
      if (!response.ok) {
        throw new Error(data.error ?? `Suggestion failed (${data.code ?? response.status}).`);
      }
      setPayload(data);
      const fields = (Object.keys(FIELD_LABELS) as TopicAiSuggestionField[]).filter(
        (field) => data.suggestions[field] !== undefined,
      );
      setSelected(new Set(fields));
      setMessage(`Suggestions ready from ${data.model}. Review and apply selected fields.`);
    } catch (generateError) {
      setPayload(null);
      setSelected(new Set());
      setError(generateError instanceof Error ? generateError.message : "Suggestion failed.");
    } finally {
      setLoading(false);
    }
  }

  async function applySelected() {
    if (!payload || selected.size === 0) {
      setError("Select at least one suggested field to apply.");
      return;
    }
    if (
      !window.confirm(
        `Apply ${selected.size} selected suggestion${selected.size === 1 ? "" : "s"} to this topic?`,
      )
    ) {
      return;
    }

    setApplying(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/cms/topics/${topicId}/suggestions/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: payload.expectedUpdatedAt || expectedUpdatedAt,
          selectedFields: [...selected],
          suggestions: payload.suggestions,
        }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Apply failed (${data.code ?? response.status}).`);
      }
      setMessage("Selected suggestions applied.");
      setPayload(null);
      setSelected(new Set());
      onApplied();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="admin-card topic-ai-suggestions" aria-busy={loading || applying}>
      <div className="topic-section-heading">
        <div>
          <h2>AI suggestions</h2>
          <p>Generate OpenRouter proposals, compare fields, then confirm Apply. Status is never changed.</p>
        </div>
        <button
          className="admin-button secondary"
          type="button"
          disabled={loading || applying}
          onClick={generate}
        >
          {loading ? "Generating…" : "Generate AI suggestions"}
        </button>
      </div>

      {payload?.warnings?.length ? (
        <ul className="topic-ai-warnings">
          {payload.warnings.map((warning) => (
            <li key={`${warning.sourceId}-${warning.fetchStatus}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      {payload?.suggestions.rationale ? (
        <p className="topic-ai-rationale">
          <strong>Rationale:</strong> {payload.suggestions.rationale}
        </p>
      ) : null}

      {suggestedFields.length ? (
        <>
          <div className="topic-ai-toolbar">
            <button className="admin-button secondary" type="button" onClick={selectAll} disabled={applying}>
              Select all
            </button>
            <button className="admin-button secondary" type="button" onClick={clearSelection} disabled={applying}>
              Clear
            </button>
            <button
              className="admin-button"
              type="button"
              disabled={applying || selected.size === 0}
              onClick={applySelected}
            >
              {applying ? "Applying…" : `Apply selected (${selected.size})`}
            </button>
          </div>

          <div className="topic-ai-comparison-grid">
            {suggestedFields.map((field) => {
              const proposed = payload!.suggestions[field];
              const checked = selected.has(field);
              return (
                <label
                  key={field}
                  className={`topic-ai-comparison-card${checked ? " selected" : ""}`}
                >
                  <div className="topic-ai-comparison-header">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleField(field)}
                      disabled={applying}
                    />
                    <strong>{FIELD_LABELS[field]}</strong>
                  </div>
                  <div className="topic-ai-comparison-values">
                    <div>
                      <span>Current</span>
                      <p>{formatValue(currentValues[field])}</p>
                    </div>
                    <div>
                      <span>Suggested</span>
                      <p>{formatValue(proposed)}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      ) : (
        <p className="topic-ai-empty">
          No suggestions yet. Generate proposals after reviewing the linked sources.
        </p>
      )}

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
    </section>
  );
}
