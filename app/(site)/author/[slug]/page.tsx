import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { getArticlesByAuthor, getAuthor, getContentBundle } from "@/lib/content";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

/** Only known author slugs render; unknown archives 404 without on-demand generation. */
export const dynamicParams = false;

export function generateStaticParams() {
  return getContentBundle().authors.map((author) => ({ slug: author.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthor(slug);

  return author ? { title: `${author.name} Articles` } : {};
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params;
  const author = getAuthor(slug);

  if (!author) {
    notFound();
  }

  const articles = getArticlesByAuthor(author.slug);

  return (
    <main id="main">
      <section className="archive-header">
        <p className="eyebrow">Author archive</p>
        <h1>{author.name}</h1>
        <p>{articles.length} reviewed articles recovered for this author.</p>
      </section>
      <section className="section">
        <div className="card-grid">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </main>
  );
}
