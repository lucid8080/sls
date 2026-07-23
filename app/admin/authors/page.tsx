"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuthorSummary = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatarPath: string | null;
  updatedAt: string;
};

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);

  function loadAuthors() {
    fetch("/api/cms/authors")
      .then(async (response) => {
        const data = (await response.json()) as { authors?: AuthorSummary[]; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load authors.");
        }
        setAuthors(data.authors ?? []);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }

  useEffect(() => {
    loadAuthors();
  }, []);

  async function createAuthor(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError("");

    const response = await fetch("/api/cms/authors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), slug: slug.trim() || undefined }),
    });

    const data = (await response.json()) as { error?: string };
    setCreating(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to create author.");
      return;
    }

    setName("");
    setSlug("");
    loadAuthors();
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>Authors</h1>
        <p style={{ color: "var(--admin-muted, #64748b)", marginTop: "0.5rem" }}>
          Manage author profiles used in article bylines and “About the author” sections.
        </p>

        <form
          onSubmit={createAuthor}
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}
        >
          <input
            className="admin-input"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ minWidth: "12rem", flex: 1 }}
          />
          <input
            className="admin-input"
            placeholder="Slug (optional)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{ minWidth: "10rem", flex: 1 }}
          />
          <button className="admin-button" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Add author"}
          </button>
        </form>

        {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

        <table className="admin-table" style={{ marginTop: "1.25rem" }}>
          <thead>
            <tr>
              <th>Author</th>
              <th>Slug</th>
              <th>Bio</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {authors.map((author) => (
              <tr key={author.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {author.avatarPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={author.avatarPath}
                        alt=""
                        width={36}
                        height={36}
                        style={{ borderRadius: "999px", objectFit: "cover" }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "999px",
                          background: "#e2e8f0",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {author.name
                          .split(/\s+/)
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                    <Link href={`/admin/authors/${author.id}`}>{author.name}</Link>
                  </div>
                </td>
                <td>{author.slug}</td>
                <td>{author.bio ? `${author.bio.slice(0, 80)}${author.bio.length > 80 ? "…" : ""}` : "—"}</td>
                <td>{new Date(author.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {authors.length === 0 ? (
              <tr>
                <td colSpan={4}>No authors yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
