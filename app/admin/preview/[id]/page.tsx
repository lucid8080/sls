import { notFound } from "next/navigation";
import { SafeHtml } from "@/components/SafeHtml";
import { getArticleById } from "@/lib/cms/articles";
import { isDatabaseConfigured } from "@/lib/cms/db/client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PreviewArticlePage({ params }: PageProps) {
  if (!isDatabaseConfigured()) {
    notFound();
  }

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) {
    notFound();
  }

  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h1>{article.title}</h1>
        <p>
          Status: {article.status} · Slug: {article.slug}
        </p>
        <SafeHtml html={article.html} />
      </section>
    </div>
  );
}
