"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ArticleSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  source: "database" | "recovered";
};

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);

    fetch(`/api/cms/articles?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as { articles?: ArticleSummary[]; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load articles.");
        }
        setArticles(data.articles ?? []);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, [status, search]);

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <h1>Articles</h1>
          <Link className="admin-button" href="/admin/articles/new">
            New article
          </Link>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <input
            className="admin-input"
            placeholder="Search title or slug"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
        <table className="admin-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Source</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td>
                  <Link href={`/admin/articles/${article.id}`}>{article.title}</Link>
                </td>
                <td>{article.source === "database" ? "CMS" : "Recovered"}</td>
                <td>
                  <span className={`admin-status ${article.status}`}>{article.status}</span>
                </td>
                <td>{new Date(article.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
