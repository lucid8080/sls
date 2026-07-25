"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeaturedImageField } from "@/components/cms/FeaturedImageField";
import { RichTextEditor } from "@/components/cms/RichTextEditor";
import type { ArticleAiSuggestion, ArticleAiSuggestionField } from "@/lib/cms/article-suggestions";
import { normalizeFeaturedImage } from "@/lib/cms/featured-image";
import { formatPublishGateError } from "@/lib/cms/publish-messages";
import type { FeaturedImage } from "@/lib/cms/schemas";

type TaxonomyTerm = { id: string; name: string; slug: string };

type ArticleAuthor = { id: string; name: string; slug: string };

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  html: string;
  author: ArticleAuthor | null;
  categories: TaxonomyTerm[];
  tags: TaxonomyTerm[];
  featuredImage: FeaturedImage | null;
  seo: {
    title?: string;
    description?: string;
    canonicalPath: string;
    ogImage?: string;
    noindex: boolean;
  };
  updatedAt: string;
  source: "database" | "recovered";
};

type SuggestionResponse = {
  suggestions: ArticleAiSuggestion;
  generatedAt: string;
  model: string;
  expectedUpdatedAt: string;
  articleStatus: string;
  error?: string;
  code?: string;
};

const FIELD_LABELS: Record<ArticleAiSuggestionField, string> = {
  title: "Title",
  excerpt: "Excerpt",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  categories: "Categories",
  tags: "Tags",
  html: "Body HTML",
};

function formatTaxonomy(terms: TaxonomyTerm[] | undefined): string {
  if (!terms?.length) return "—";
  return terms.map((term) => term.name).join(", ");
}

function formatSuggestionValue(field: ArticleAiSuggestionField, value: unknown): string {
  if (field === "categories" || field === "tags") {
    return formatTaxonomy(value as TaxonomyTerm[] | undefined);
  }
  if (field === "html") {
    const html = String(value ?? "");
    return html ? `${html.slice(0, 280)}${html.length > 280 ? "…" : ""}` : "—";
  }
  if (value == null || value === "") return "—";
  return String(value);
}

export function ArticleEditor({ articleId }: { articleId: string }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [authors, setAuthors] = useState<ArticleAuthor[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestionPayload, setSuggestionPayload] = useState<SuggestionResponse | null>(null);
  const [selected, setSelected] = useState<Set<ArticleAiSuggestionField>>(new Set());

  const dirty = useMemo(() => {
    if (!article) return false;
    return JSON.stringify(article) !== savedSnapshot;
  }, [article, savedSnapshot]);

  useEffect(() => {
    fetch(`/api/cms/articles/${articleId}`)
      .then(async (response) => {
        const data = (await response.json()) as { article?: Article; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load article.");
        }
        const loaded = data.article
          ? {
              ...data.article,
              author: data.article.author ?? null,
              featuredImage: normalizeFeaturedImage(data.article.featuredImage) ?? null,
            }
          : null;
        setArticle(loaded);
        setSavedSnapshot(loaded ? JSON.stringify(loaded) : "");
      })
      .catch((loadError: Error) => setError(loadError.message));

    fetch("/api/cms/authors")
      .then(async (response) => {
        const data = (await response.json()) as { authors?: ArticleAuthor[]; error?: string };
        if (response.ok) {
          setAuthors(data.authors ?? []);
        }
      })
      .catch(() => {
        // Author picker remains empty if the authors API is unavailable.
      });
  }, [articleId]);

  const suggestedFields = useMemo(() => {
    if (!suggestionPayload?.suggestions) return [] as ArticleAiSuggestionField[];
    return (Object.keys(FIELD_LABELS) as ArticleAiSuggestionField[]).filter(
      (field) => suggestionPayload.suggestions[field] !== undefined,
    );
  }, [suggestionPayload]);

  async function save() {
    if (!article) return;
    setSaving(true);
    setError("");
    setMessage("");

    // Status transitions go through the Publish action; PATCH rejects
    // `status: "published"`, so omit status here to allow saving edits to a
    // published article without flipping it out of published.
    const saveable = {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      html: article.html,
      author: article.author,
      categories: article.categories,
      tags: article.tags,
      featuredImage: article.featuredImage,
      seo: article.seo,
    };

    const response = await fetch(`/api/cms/articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saveable),
    });

    const data = (await response.json()) as { article?: Article; error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save.");
      return;
    }

    if (data.article) {
      const saved = {
        ...data.article,
        author: data.article.author ?? null,
        featuredImage: normalizeFeaturedImage(data.article.featuredImage) ?? null,
      };
      setArticle(saved);
      setSavedSnapshot(JSON.stringify(saved));
    }
    setMessage("Saved.");
  }

  async function publish(action: "review" | "publish") {
    if (article?.source === "recovered") {
      setError("Save this recovered article before submitting it for review or publishing.");
      return;
    }
    if (dirty) {
      setError("Save your changes before submitting for review or publishing.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/cms/articles/${articleId}/publish?action=${action}`, {
      method: "POST",
    });
    const data = (await response.json()) as {
      error?: string;
      issues?: Array<{ code: string; message: string; severity: string }>;
      deployTriggered?: boolean;
      exportCount?: number;
    };
    setSaving(false);

    if (!response.ok) {
      setError(formatPublishGateError(data.error ?? "Action failed.", data.issues));
      return;
    }

    setMessage(
      action === "review"
        ? "Submitted for review."
        : `Published.${data.deployTriggered ? " Deploy triggered." : ""}`,
    );
  }

  async function generateSuggestions() {
    if (!article) return;
    if (article.source === "recovered") {
      setError("Save this recovered article before generating AI suggestions.");
      return;
    }
    if (dirty) {
      setError("Save your changes before generating AI suggestions.");
      return;
    }

    setSuggesting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/cms/articles/${articleId}/suggestions`, {
        method: "POST",
      });
      const data = (await response.json()) as SuggestionResponse;
      if (!response.ok) {
        throw new Error(data.error ?? `Suggestion failed (${data.code ?? response.status}).`);
      }
      setSuggestionPayload(data);
      const fields = (Object.keys(FIELD_LABELS) as ArticleAiSuggestionField[]).filter(
        (field) => data.suggestions[field] !== undefined,
      );
      setSelected(new Set(fields));
      setMessage(`Suggestions ready from ${data.model}. Review and apply selected fields.`);
    } catch (generateError) {
      setSuggestionPayload(null);
      setSelected(new Set());
      setError(generateError instanceof Error ? generateError.message : "Suggestion failed.");
    } finally {
      setSuggesting(false);
    }
  }

  async function applySelectedSuggestions() {
    if (!article || !suggestionPayload || selected.size === 0) {
      setError("Select at least one suggested field to apply.");
      return;
    }
    if (dirty) {
      setError("Save your local edits before applying AI suggestions.");
      return;
    }
    if (
      !window.confirm(
        `Apply ${selected.size} selected suggestion${selected.size === 1 ? "" : "s"} and save a revision?`,
      )
    ) {
      return;
    }

    setApplying(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/cms/articles/${articleId}/suggestions/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: suggestionPayload.expectedUpdatedAt,
          selectedFields: [...selected],
          suggestions: suggestionPayload.suggestions,
        }),
      });
      const data = (await response.json()) as {
        article?: Article;
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? `Apply failed (${data.code ?? response.status}).`);
      }
      if (data.article) {
        const saved = {
          ...data.article,
          author: data.article.author ?? null,
          featuredImage: normalizeFeaturedImage(data.article.featuredImage) ?? null,
        };
        setArticle(saved);
        setSavedSnapshot(JSON.stringify(saved));
      }
      setSuggestionPayload(null);
      setSelected(new Set());
      setMessage("Selected suggestions applied and saved.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  function toggleField(field: ArticleAiSuggestionField) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  if (!article) {
    return <p>{error || "Loading..."}</p>;
  }

  const currentValues: Record<ArticleAiSuggestionField, unknown> = {
    title: article.title,
    excerpt: article.excerpt,
    seoTitle: article.seo.title,
    seoDescription: article.seo.description,
    categories: article.categories,
    tags: article.tags,
    html: article.html,
  };

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <h1>Edit article</h1>
          <Link className="admin-button secondary" href={`/admin/preview/${articleId}`}>
            Preview
          </Link>
        </div>
        <div className="admin-grid" style={{ marginTop: "1rem" }}>
          <input
            className="admin-input"
            value={article.title}
            onChange={(e) => setArticle({ ...article, title: e.target.value })}
          />
          <input
            className="admin-input"
            value={article.slug}
            onChange={(e) => setArticle({ ...article, slug: e.target.value })}
          />
          <textarea
            className="admin-textarea"
            rows={3}
            value={article.excerpt ?? ""}
            onChange={(e) => setArticle({ ...article, excerpt: e.target.value })}
          />
          <FeaturedImageField
            value={article.featuredImage}
            disabled={saving}
            onChange={(featuredImage) =>
              setArticle({
                ...article,
                featuredImage,
                seo: {
                  ...article.seo,
                  ogImage: featuredImage?.src,
                },
              })
            }
          />
          <label>
            <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>Author</span>
            <select
              className="admin-select"
              value={article.author?.id ?? ""}
              onChange={(e) => {
                const selectedAuthor = authors.find((author) => author.id === e.target.value);
                setArticle({
                  ...article,
                  author: selectedAuthor
                    ? { id: selectedAuthor.id, name: selectedAuthor.name, slug: selectedAuthor.slug }
                    : null,
                });
              }}
            >
              <option value="">No author</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
              {article.author && !authors.some((author) => author.id === article.author?.id) ? (
                <option value={article.author.id}>{article.author.name} (current)</option>
              ) : null}
            </select>
          </label>
          <RichTextEditor value={article.html} onChange={(html) => setArticle({ ...article, html })} />
          <div className="admin-grid two">
            <input
              className="admin-input"
              placeholder="SEO title"
              value={article.seo.title ?? ""}
              onChange={(e) => setArticle({ ...article, seo: { ...article.seo, title: e.target.value } })}
            />
            <input
              className="admin-input"
              placeholder="SEO description"
              value={article.seo.description ?? ""}
              onChange={(e) =>
                setArticle({ ...article, seo: { ...article.seo, description: e.target.value } })
              }
            />
          </div>
          <p>
            <strong>Categories:</strong> {formatTaxonomy(article.categories)}
          </p>
          <p>
            <strong>Tags:</strong> {formatTaxonomy(article.tags)}
          </p>
          {article.source === "recovered" ? (
            <p className="admin-error" role="status">
              This article comes from the recovered catalog. Saving it creates an editable CMS override.
            </p>
          ) : null}
          {dirty ? (
            <p className="admin-error" role="status">
              You have unsaved changes. Save before generating suggestions, review, or publish.
            </p>
          ) : null}
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
          {message ? <p style={{ color: "#047857" }}>{message}</p> : null}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="admin-button secondary" type="button" disabled={saving} onClick={save}>
              Save
            </button>
            <button
              className="admin-button secondary"
              type="button"
              disabled={saving || dirty || article.source === "recovered"}
              onClick={() => publish("review")}
            >
              Submit for review
            </button>
            <button
              className="admin-button"
              type="button"
              disabled={saving || dirty || article.source === "recovered"}
              onClick={() => publish("publish")}
            >
              Publish
            </button>
          </div>
        </div>
      </section>

      <section className="admin-card article-ai-suggestions" aria-busy={suggesting || applying}>
        <div className="topic-section-heading">
          <div>
            <h2>AI suggestions</h2>
            <p>
              Generate OpenRouter proposals for title, excerpt, SEO, taxonomy, and body. Apply creates
              one saved revision and never changes status.
            </p>
          </div>
          <button
            className="admin-button secondary"
            type="button"
            disabled={suggesting || applying || dirty || article.source === "recovered"}
            onClick={generateSuggestions}
          >
            {suggesting ? "Generating…" : "Generate AI suggestions"}
          </button>
        </div>

        {suggestionPayload?.suggestions.rationale ? (
          <p className="topic-ai-rationale">
            <strong>Rationale:</strong> {suggestionPayload.suggestions.rationale}
          </p>
        ) : null}

        {suggestedFields.length ? (
          <>
            <div className="topic-ai-toolbar">
              <button
                className="admin-button secondary"
                type="button"
                onClick={() => setSelected(new Set(suggestedFields))}
                disabled={applying}
              >
                Select all
              </button>
              <button
                className="admin-button secondary"
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={applying}
              >
                Clear
              </button>
              <button
                className="admin-button"
                type="button"
                disabled={applying || selected.size === 0}
                onClick={applySelectedSuggestions}
              >
                {applying ? "Applying…" : `Apply selected (${selected.size})`}
              </button>
            </div>
            <div className="topic-ai-comparison-grid">
              {suggestedFields.map((field) => {
                const checked = selected.has(field);
                const suggestedValue = suggestionPayload!.suggestions[field];
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
                        <p>{formatSuggestionValue(field, currentValues[field])}</p>
                      </div>
                      <div>
                        <span>Suggested</span>
                        <p>{formatSuggestionValue(field, suggestedValue)}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <p className="topic-ai-empty">
            {article.source === "recovered"
              ? "Save this recovered article to the CMS before generating suggestions."
              : "Save the article, then generate suggestions to compare fields."}
          </p>
        )}
      </section>
    </div>
  );
}
