"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AuthorSocials = {
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  website?: string;
};

type Author = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatarPath: string | null;
  socials: AuthorSocials;
  updatedAt: string;
};

type MediaSummary = {
  id: string;
  publicPath: string;
  alt: string | null;
};

export default function AdminAuthorEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const authorId = params.id;

  const [author, setAuthor] = useState<Author | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [media, setMedia] = useState<MediaSummary[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`/api/cms/authors/${authorId}`)
      .then(async (response) => {
        const data = (await response.json()) as { author?: Author; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Failed to load author.");
        setAuthor(data.author ?? null);
      })
      .catch((loadError: Error) => setError(loadError.message));

    fetch("/api/cms/media?limit=30")
      .then(async (response) => {
        const data = (await response.json()) as { media?: MediaSummary[] };
        if (response.ok) setMedia(data.media ?? []);
      })
      .catch(() => {
        // Media picker is optional; author can still save without it.
      });
  }, [authorId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!author) return;

    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/cms/authors/${authorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: author.name,
        slug: author.slug,
        bio: author.bio,
        avatarPath: author.avatarPath,
        socials: author.socials,
      }),
    });

    const data = (await response.json()) as { author?: Author; error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save author.");
      return;
    }

    if (data.author) setAuthor(data.author);
    setMessage("Saved. Site export updated.");
  }

  async function remove() {
    if (!author) return;
    if (!window.confirm(`Delete author "${author.name}"? This cannot be undone.`)) return;

    setDeleting(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/cms/authors/${authorId}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    setDeleting(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to delete author.");
      return;
    }

    router.push("/admin/authors");
  }

  async function uploadAvatar(file: File | null) {
    if (!file || !author) return;

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt", `${author.name} avatar`);

    const response = await fetch("/api/cms/media", { method: "POST", body: formData });
    const data = (await response.json()) as {
      media?: { publicPath?: string };
      error?: string;
    };
    setUploading(false);

    if (!response.ok) {
      setError(data.error ?? "Avatar upload failed.");
      return;
    }

    const path = data.media?.publicPath;
    if (path) {
      setAuthor({ ...author, avatarPath: path });
      setMessage("Avatar uploaded — click Save to apply.");
    }
  }

  if (!author) {
    return <p>{error || "Loading…"}</p>;
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <h1>Edit author</h1>
          <Link className="admin-button secondary" href="/admin/authors">
            Back to authors
          </Link>
        </div>

        <form onSubmit={save} className="admin-grid" style={{ marginTop: "1rem" }}>
          <label>
            <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>Name</span>
            <input
              className="admin-input"
              value={author.name}
              onChange={(e) => setAuthor({ ...author, name: e.target.value })}
              required
            />
          </label>

          <label>
            <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>Slug</span>
            <input
              className="admin-input"
              value={author.slug}
              onChange={(e) => setAuthor({ ...author, slug: e.target.value })}
              required
            />
          </label>

          <label>
            <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>Bio</span>
            <textarea
              className="admin-textarea"
              rows={5}
              value={author.bio ?? ""}
              onChange={(e) => setAuthor({ ...author, bio: e.target.value })}
              placeholder="Short author biography shown under articles."
            />
          </label>

          <div>
            <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>Avatar</span>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              {author.avatarPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.avatarPath}
                  alt=""
                  width={72}
                  height={72}
                  style={{ borderRadius: "999px", objectFit: "cover" }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "999px",
                    background: "#e2e8f0",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
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
              <div style={{ display: "grid", gap: "0.5rem", flex: 1, minWidth: "14rem" }}>
                <input
                  className="admin-input"
                  placeholder="/media/… path"
                  value={author.avatarPath ?? ""}
                  onChange={(e) => setAuthor({ ...author, avatarPath: e.target.value || null })}
                />
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null)}
                />
                {media.length > 0 ? (
                  <select
                    className="admin-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setAuthor({ ...author, avatarPath: e.target.value });
                    }}
                  >
                    <option value="">Pick from recent media…</option>
                    {media.map((item) => (
                      <option key={item.id} value={item.publicPath}>
                        {item.alt || item.publicPath}
                      </option>
                    ))}
                  </select>
                ) : null}
                {author.avatarPath ? (
                  <button
                    className="admin-button secondary"
                    type="button"
                    onClick={() => setAuthor({ ...author, avatarPath: null })}
                  >
                    Clear avatar
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="admin-grid two">
            <label>
              <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>X / Twitter URL</span>
              <input
                className="admin-input"
                value={author.socials.twitter ?? ""}
                onChange={(e) =>
                  setAuthor({ ...author, socials: { ...author.socials, twitter: e.target.value } })
                }
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>LinkedIn URL</span>
              <input
                className="admin-input"
                value={author.socials.linkedin ?? ""}
                onChange={(e) =>
                  setAuthor({ ...author, socials: { ...author.socials, linkedin: e.target.value } })
                }
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>Facebook URL</span>
              <input
                className="admin-input"
                value={author.socials.facebook ?? ""}
                onChange={(e) =>
                  setAuthor({ ...author, socials: { ...author.socials, facebook: e.target.value } })
                }
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>Website URL</span>
              <input
                className="admin-input"
                value={author.socials.website ?? ""}
                onChange={(e) =>
                  setAuthor({ ...author, socials: { ...author.socials, website: e.target.value } })
                }
              />
            </label>
          </div>

          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
          {message ? <p style={{ color: "#047857" }}>{message}</p> : null}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="admin-button" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="admin-button secondary"
              type="button"
              disabled={deleting}
              onClick={remove}
              style={{ color: "#b91c1c" }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
