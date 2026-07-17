"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/cms/RichTextEditor";

type Article = {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  html: string;
  seo: {
    title?: string;
    description?: string;
    canonicalPath: string;
    ogImage?: string;
    noindex: boolean;
  };
};

export function ArticleEditor({ articleId }: { articleId: string }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/cms/articles/${articleId}`)
      .then(async (response) => {
        const data = (await response.json()) as { article?: Article; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load article.");
        }
        setArticle(data.article ?? null);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [articleId]);

  async function save() {
    if (!article) return;
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/cms/articles/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(article),
    });

    const data = (await response.json()) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save.");
      return;
    }

    setMessage("Saved.");
  }

  async function publish(action: "review" | "publish") {
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/cms/articles/${articleId}/publish?action=${action}`, {
      method: "POST",
    });
    const data = (await response.json()) as { error?: string; deployTriggered?: boolean };
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }

    setMessage(action === "review" ? "Submitted for review." : `Published.${data.deployTriggered ? " Deploy triggered." : ""}`);
  }

  if (!article) {
    return <p>{error || "Loading..."}</p>;
  }

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
              onChange={(e) => setArticle({ ...article, seo: { ...article.seo, description: e.target.value } })}
            />
          </div>
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
          {message ? <p style={{ color: "#047857" }}>{message}</p> : null}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="admin-button secondary" type="button" disabled={saving} onClick={save}>
              Save
            </button>
            <button className="admin-button secondary" type="button" disabled={saving} onClick={() => publish("review")}>
              Submit for review
            </button>
            <button className="admin-button" type="button" disabled={saving} onClick={() => publish("publish")}>
              Publish
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
