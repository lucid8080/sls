"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FeaturedImageField } from "@/components/cms/FeaturedImageField";
import { RichTextEditor } from "@/components/cms/RichTextEditor";
import type { FeaturedImage } from "@/lib/cms/schemas";

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [html, setHtml] = useState("<p></p>");
  const [featuredImage, setFeaturedImage] = useState<FeaturedImage | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(status: "draft" | "in_review") {
    setSaving(true);
    setError("");

    const response = await fetch("/api/cms/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug: slug || undefined,
        excerpt,
        html,
        status,
        featuredImage,
        seo: featuredImage
          ? {
              ogImage: featuredImage.src,
            }
          : undefined,
      }),
    });

    const data = (await response.json()) as { article?: { id: string }; error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save article.");
      return;
    }

    router.push(`/admin/articles/${data.article?.id}`);
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>New article</h1>
        <div className="admin-grid" style={{ marginTop: "1rem" }}>
          <input className="admin-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="admin-input" placeholder="Slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <textarea
            className="admin-textarea"
            placeholder="Excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
          />
          <FeaturedImageField value={featuredImage} onChange={setFeaturedImage} disabled={saving} />
          <RichTextEditor value={html} onChange={setHtml} />
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="admin-button secondary" type="button" disabled={saving} onClick={() => save("draft")}>
              Save draft
            </button>
            <button className="admin-button" type="button" disabled={saving} onClick={() => save("in_review")}>
              Submit for review
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
